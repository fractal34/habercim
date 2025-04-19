// Kategoriler ve RSS URL'leri
const categoryRssUrls = {
    'Son Dakika': 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml',
    'Spor': 'http://www.haberturk.com/rss/spor.xml',
    'Magazin': 'https://www.milliyet.com.tr/rss/rssnew/magazinrss.xml',
    'Dünya': 'https://www.milliyet.com.tr/rss/rssnew/dunyarss.xml',
    'Gündem': 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml',
    'Otomobil': 'https://tr.motor1.com/rss/articles/all/', // Güncellendi
    'Teknoloji': 'https://onedio.com/Publisher/publisher-teknoloji.rss', // Yeni eklendi
};

const categoryColors = {
    'Son Dakika': '#ff0000',
    'Spor': '#008000',
    'Magazin': '#800080',
    'Dünya': '#ffa500',
    'Gündem': '#0000ff',
    'Otomobil': '#00008B',
    'Teknoloji': '#00BFFF', // Yeni renk: Derin Gökyüzü Mavisi
};

// CORS proxy URL'si
const corsProxy = 'https://habercim.vercel.app/api/proxy?url=';

// Her kategoriden çekilecek maksimum haber sayısı
const MAX_NEWS_PER_CATEGORY = 50;

// Seçili kategoriler (varsayılan olarak Son Dakika seçili)
let selectedCategories = ['Son Dakika'];
let allNews = [];
let displayedNewsCount = 50;
let isLoadingMore = false;
let lastRenderedNewsCount = 0;

// Saat güncellemesi
function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

// Kategori butonlarını dinle
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', () => {
        const category = button.dataset.category;
        if (selectedCategories.includes(category)) {
            selectedCategories = selectedCategories.filter(cat => cat !== category);
        } else {
            selectedCategories.push(category);
        }

        document.querySelectorAll('.category-btn').forEach(btn => {
            if (selectedCategories.includes(btn.dataset.category)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        fetchNews();
    });
});

// RSS'ten haberleri çek
async function fetchNews() {
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = '<p>Yükleniyor...</p>';
    allNews = [];
    displayedNewsCount = 50;
    lastRenderedNewsCount = 0;

    if (selectedCategories.length === 0) {
        newsList.innerHTML = '<p>Lütfen en az bir kategori seçin</p>';
        return;
    }

    const newsById = new Map();

    try {
        for (const category of selectedCategories) {
            const url = categoryRssUrls[category];
            if (!url) {
                console.warn(`No RSS URL found for category: ${category}`);
                continue;
            }

            const proxyUrl = `${corsProxy}${url}`;
            console.log(`Fetching RSS for ${category}: ${proxyUrl}`);
            let response;
            try {
                response = await fetch(proxyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                    mode: 'cors',
                });
            } catch (error) {
                console.error(`Error fetching RSS for ${category}: ${error.message}`);
                continue;
            }

            if (!response.ok) {
                console.error(`Failed to fetch RSS for ${category}: ${response.status} (${response.statusText})`);
                continue;
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const items = Array.from(xml.querySelectorAll('item')).slice(0, MAX_NEWS_PER_CATEGORY);

            console.log(`Fetched ${items.length} items for category ${category} (limited to ${MAX_NEWS_PER_CATEGORY})`);

            items.forEach(item => {
                let link = item.querySelector('link')?.textContent || '';
                const guid = item.querySelector('guid')?.textContent || '';

                if (!link && guid) {
                    link = guid;
                }

                if (link && !link.startsWith('http')) {
                    console.log(`Converting news ID to URL: ${link}`);
                    const categorySlug = category.toLowerCase().replace('ı', 'i').replace('ş', 's').replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o').replace('ç', 'c');
                    const title = item.querySelector('title')?.textContent || 'haber';
                    const titleSlug = title.toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace('ı', 'i').replace('ş', 's').replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o').replace('ç', 'c');
                    link = `https://www.milliyet.com.tr/${categorySlug}/${titleSlug}-${link}`;
                }

                if (!link || !link.startsWith('http')) {
                    console.warn(`Skipping item in ${category}: No valid link or guid found after conversion: ${link}`);
                    return;
                }

                // Haber ID'sini çıkar (Milliyet ve Habertürk için farklı formatlar)
                let newsId;
                let sourcePrefix = '';
                if (link.includes('milliyet.com.tr')) {
                    const match = link.match(/(\d+)$/);
                    newsId = match ? match[0] : link;
                    sourcePrefix = 'milliyet-';
                } else if (link.includes('haberturk.com')) {
                    const match = link.match(/haber-(\d+)/);
                    newsId = match ? match[1] : link;
                    sourcePrefix = 'haberturk-';
                } else {
                    newsId = link;
                    sourcePrefix = 'unknown-';
                }

                // Benzersiz bir anahtar oluştur (newsId ile birlikte title ve pubDate kullan)
                const title = item.querySelector('title')?.textContent || 'Başlık Yok';
                let pubDate = new Date();
                const pubDateStr = item.querySelector('pubDate')?.textContent;
                if (pubDateStr) {
                    pubDate = new Date(pubDateStr);
                    if (isNaN(pubDate)) {
                        console.warn(`Invalid pubDate for item in ${category}: ${pubDateStr}`);
                        pubDate = new Date();
                    }
                }
                const uniqueKey = `${sourcePrefix}${newsId}-${title}-${pubDate.toISOString()}`; // Benzersiz anahtar

                let imageUrl = '';
                let description = item.querySelector('description')?.textContent || '';
                if (description) {
                    const div = document.createElement('div');
                    div.innerHTML = description;
                    const img = div.querySelector('img');
                    if (img) imageUrl = img.src;
                    description = div.textContent || '';
                }
                if (!imageUrl) {
                    const enclosure = item.querySelector('enclosure');
                    if (enclosure) imageUrl = enclosure.getAttribute('url');
                }

                const newsItem = {
                    categories: [category],
                    title,
                    imageUrl,
                    description,
                    date: pubDate,
                    link,
                    source: url.includes('milliyet') ? 'milliyet' : 'haberturk',
                };

                console.log(`Adding news item to ${category}: ${title}, Link: ${link}, Unique Key: ${uniqueKey}, Source: ${newsItem.source}`);

                if (!newsById.has(uniqueKey)) {
                    newsById.set(uniqueKey, newsItem);
                    allNews.push(newsItem);
                } else {
                    const existing = newsById.get(uniqueKey);
                    if (!existing.categories.includes(category)) {
                        existing.categories.push(category);
                    }
                }
            });
        }

        console.log(`Total news items in allNews: ${allNews.length}`);
        if (allNews.length > 0) {
            console.log(`First news item: ${JSON.stringify(allNews[0])}`);
        }

        allNews.sort((a, b) => b.date - a.date);

        console.log('First few news after sorting:');
        allNews.slice(0, 5).forEach((news, index) => {
            console.log(`News ${index + 1}: ${news.title}, Date: ${news.date}, Categories: ${news.categories}, Link: ${news.link}, Source: ${news.source}`);
        });

        renderNews();
    } catch (error) {
        console.error('Error fetching news:', error);
        newsList.innerHTML = `<p>Haberler yüklenemedi: ${error.message}</p>`;
    }
}

// Haberleri render et
function renderNews() {
    const newsList = document.getElementById('news-list');

    if (lastRenderedNewsCount === 0) {
        newsList.innerHTML = '';
    }

    console.log(`allNews length before rendering: ${allNews.length}`);

    const newsToShow = allNews.slice(lastRenderedNewsCount, displayedNewsCount);
    console.log(`News to show: ${newsToShow.length} items`);

    if (newsToShow.length === 0 && lastRenderedNewsCount === 0) {
        newsList.innerHTML = '<p>Seçili kategoriler için haber bulunamadı</p>';
        return;
    }

    newsToShow.forEach(news => {
        const categories = news.categories;
        const primaryCategory = categories[0];
        const color = categoryColors[primaryCategory] || '#808080';
        const formattedDate = news.date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        newsItem.style.backgroundColor = color; // news-item'ın tüm background'u kategori rengine göre ayarlandı
        newsItem.innerHTML = `
            <img src="${news.imageUrl || 'https://via.placeholder.com/150'}" alt="${news.title}" class="news-image" />
            <div class="news-title" style="background-color: ${color};">${news.title}</div>
            <div class="news-date">${formattedDate}</div> <!-- Koyuluk katmanı CSS'te zaten var -->
        `;
        newsItem.addEventListener('click', () => showNewsDetail(news));
        newsList.appendChild(newsItem);
    });

    lastRenderedNewsCount = displayedNewsCount;

    console.log(`Total news: ${allNews.length}, Displayed news: ${displayedNewsCount}, Last rendered: ${lastRenderedNewsCount}`);
}

// Haber detaylarını göster
function showNewsDetail(news) {
    const newsDetail = document.getElementById('news-detail');
    let url = news.link;
    console.log(`Original URL: ${url}, Source: ${news.source}`);

    if (!url || !url.startsWith('http')) {
        console.error(`Invalid URL: ${url}`);
        newsDetail.innerHTML = `<p>Geçersiz URL: ${url}</p>`;
        return;
    }

    // Doğrudan haber URL'sini kullan
    const displayUrl = url;
    console.log(`Loading URL: ${displayUrl}`);

    newsDetail.innerHTML = `
        <iframe src="${displayUrl}" frameborder="0" style="width: 100%; height: 100%;"
            onload="console.log('Iframe loaded successfully: ${displayUrl}')"
            onerror="console.error('Iframe failed to load: ${displayUrl}, Error: ' + (this.contentDocument || this.contentWindow.document || 'Unknown error')); this.style.display='none'; this.parentElement.innerHTML='<p>Bu haber iframe içinde gösterilemiyor: ${news.source === 'milliyet' ? 'Milliyet haberleri iframe içinde açılamıyor (X-Frame-Options kısıtlaması). Lütfen başka bir haber seçin.' : 'Bilinmeyen bir hata oluştu.'}</p>';">
        </iframe>
    `;
}

// Infinite Scroll
document.getElementById('news-list').addEventListener('scroll', function () {
    const newsList = this;
    const scrollPosition = newsList.scrollTop + newsList.clientHeight;
    const scrollHeight = newsList.scrollHeight;

    console.log(`Scroll Position: ${scrollPosition}, Client Height: ${newsList.clientHeight}, Scroll Height: ${scrollHeight}`);

    if (scrollPosition >= scrollHeight * 0.9) {
        if (!isLoadingMore && displayedNewsCount < allNews.length) {
            console.log('Loading more news...');
            isLoadingMore = true;
            displayedNewsCount += 50;
            renderNews();
            isLoadingMore = false;
        } else {
            console.log('No more news to load or already loading.');
            console.log(`Displayed: ${displayedNewsCount}, Total: ${allNews.length}`);
            if (displayedNewsCount >= allNews.length && allNews.length > 0) {
                const endMessage = document.createElement('p');
                endMessage.textContent = 'Tüm haberler yüklendi.';
                endMessage.style.textAlign = 'center';
                endMessage.style.padding = '10px';
                if (!newsList.querySelector('p:last-child') || newsList.querySelector('p:last-child').textContent !== 'Tüm haberler yüklendi.') {
                    newsList.appendChild(endMessage);
                }
            }
        }
    }
});

// İlk yükleme
fetchNews();
