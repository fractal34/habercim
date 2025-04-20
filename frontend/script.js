// Kategoriler ve RSS URL'leri (Her kategoriye birden fazla kaynak)
const categoryRssUrls = {
    'Son Dakika': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml',
        'Sabah': 'https://www.sabah.com.tr/rss/sondakika.xml',
        'Mynet': 'http://www.mynet.com/haber/rss/sondakika',
    },
    'Spor': {
        'Habertürk': 'http://www.haberturk.com/rss/spor.xml',
    },
    'Magazin': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/magazinrss.xml',
    },
    'Politika': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/siyasetrss.xml',
    },
    'Dünya': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/dunyarss.xml',
    },
    'Gündem': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/gundem.xml',
    },
    'Otomobil': {
        'Otoaktuel': 'https://www.otoaktuel.com.tr/rss',
    },
    'Teknoloji': {
        'Onedio': 'https://onedio.com/Publisher/publisher-teknoloji.rss',
    },
};

const categoryColors = {
    'Son Dakika': '#ff0000',
    'Spor': '#008000',
    'Magazin': '#800080',
    'Dünya': '#ffa500',
    'Gündem': '#0000ff',
    'Politika': '#333',
    'Otomobil': '#00008B',
    'Teknoloji': '#00BFFF',
};

// CORS proxy URL'si
const corsProxy = 'https://habercim.vercel.app/api/proxy?url=';

// Her kategoriden çekilecek maksimum haber sayısı
const MAX_NEWS_PER_CATEGORY = 50;

// Seçili kategoriler (varsayılan olarak Son Dakika seçili)
let selectedCategories = ['Son Dakika'];

// Seçili kaynaklar (varsayılan olarak her kategorideki tüm kaynaklar seçili)
let selectedSources = {};

// Her kategorideki kaynakları varsayılan olarak seçili yap
Object.keys(categoryRssUrls).forEach(category => {
    selectedSources[category] = Object.keys(categoryRssUrls[category]);
});

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

// Kaynak seçim barını güncelle
function updateSourceBar() {
    const sourceMenu = document.querySelector('.category-source-menu');
    // "KAYNAKLAR:" kısmını koru, sadece kaynakları güncelle
    sourceMenu.innerHTML = '<nav class="category-source-title">KAYNAKLAR:</nav>';

    // Seçili kategorilere göre kaynakları ekle
    selectedCategories.forEach(category => {
        const sources = categoryRssUrls[category];
        if (!sources) return;

        Object.keys(sources).forEach(source => {
            const label = document.createElement('label');
            label.className = 'source-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedSources[category].includes(source);
            checkbox.dataset.category = category;
            checkbox.dataset.source = source;

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!selectedSources[category].includes(source)) {
                        selectedSources[category].push(source);
                    }
                } else {
                    selectedSources[category] = selectedSources[category].filter(s => s !== source);
                }
                fetchNews();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(source));
            sourceMenu.appendChild(label);
        });
    });
}

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

        updateSourceBar();
        fetchNews();
    });
});

// RSS'ten haberleri çek
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
            const sources = categoryRssUrls[category];
            if (!sources) {
                console.warn(`No sources found for category: ${category}`);
                continue;
            }

            const selectedCategorySources = selectedSources[category];
            if (!selectedCategorySources || selectedCategorySources.length === 0) {
                console.warn(`No selected sources for category: ${category}`);
                continue;
            }

            for (const source of selectedCategorySources) {
                const url = sources[source];
                if (!url) {
                    console.warn(`No RSS URL found for source ${source} in category: ${category}`);
                    continue;
                }

                const proxyUrl = `${corsProxy}${url}`;
                console.log(`Fetching RSS for ${category} from ${source}: ${proxyUrl}`);
                let response;
                try {
                    response = await fetch(proxyUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                        },
                        mode: 'cors',
                    });
                } catch (error) {
                    console.error(`Error fetching RSS for ${category} from ${source}: ${error.message}`);
                    continue;
                }

                if (!response.ok) {
                    console.error(`Failed to fetch RSS for ${category} from ${source}: ${response.status} (${response.statusText})`);
                    continue;
                }

                const text = await response.text();
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'text/xml');
                const items = Array.from(xml.querySelectorAll('item')).slice(0, MAX_NEWS_PER_CATEGORY);

                console.log(`Fetched ${items.length} items for category ${category} from ${source} (limited to ${MAX_NEWS_PER_CATEGORY})`);

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
                        console.warn(`Skipping item in ${category} from ${source}: No valid link or guid found after conversion: ${link}`);
                        return;
                    }

                    // Haber ID'sini çıkar
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
                    } else if (link.includes('onedio.com')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'onedio-';
                    } else if (link.includes('otoaktuel.com.tr')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'otoaktuel-';
                    } else if (link.includes('sabah.com.tr')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'sabah-';
                    } else if (link.includes('mynet.com')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'mynet-';
                    } else {
                        newsId = link;
                        sourcePrefix = 'unknown-';
                    }

                    // Benzersiz bir anahtar oluştur
                    const title = item.querySelector('title')?.textContent || 'Başlık Yok';
                    let pubDate = new Date();
                    const pubDateStr = item.querySelector('pubDate')?.textContent;
                    if (pubDateStr) {
                        pubDate = new Date(pubDateStr);
                        if (isNaN(pubDate)) {
                            console.warn(`Invalid pubDate for item in ${category} from ${source}: ${pubDateStr}`);
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
                        if (img) {
                            imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
                        }
                        description = div.textContent || '';
                    }
                    if (!imageUrl) {
                        const enclosure = item.querySelector('enclosure[type^="image"]');
                        if (enclosure) {
                            imageUrl = enclosure.getAttribute('url') || '';
                            console.log(`Enclosure image found for ${source}: ${imageUrl}`);
                        }
                    }
                    if (!imageUrl) {
                        const mediaContents = item.getElementsByTagName('media:content');
                        for (let i = 0; i < mediaContents.length; i++) {
                            const mediaContent = mediaContents[i];
                            const type = mediaContent.getAttribute('type') || '';
                            if (type.startsWith('image/')) {
                                imageUrl = mediaContent.getAttribute('url') || '';
                                console.log(`Media:content image found for ${source}: ${imageUrl}`);
                                break;
                            }
                        }
                    }
                    if (!imageUrl && link.includes('mynet.com')) {
                        const ipImage = item.querySelector('ipimage')?.textContent || '';
                        if (ipImage) {
                            imageUrl = ipImage;
                            console.log(`ipimage found for Mynet: ${imageUrl}`);
                        }
                    }
                    if (!imageUrl) {
                        console.log(`No image found for item in ${category} from ${source}, link: ${link}`);
                        imageUrl = 'https://via.placeholder.com/150'; // Placeholder
                    }

                    const newsItem = {
                        categories: [category],
                        title,
                        imageUrl,
                        description,
                        date: pubDate,
                        link,
                        source: link.includes('milliyet') ? 'milliyet' : 
                               link.includes('haberturk') ? 'haberturk' : 
                               link.includes('onedio') ? 'onedio' : 
                               link.includes('otoaktuel') ? 'otoaktuel' : 
                               link.includes('sabah') ? 'sabah' : 
                               link.includes('mynet') ? 'mynet' : 'unknown',
                    };

                    console.log(`Adding news item to ${category} from ${source}: ${title}, Link: ${link}, Image: ${imageUrl}, Unique Key: ${uniqueKey}, Source: ${newsItem.source}`);

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
        newsItem.style.backgroundColor = color;
        newsItem.innerHTML = `
            <img src="${news.imageUrl || 'https://via.placeholder.com/150'}" alt="${news.title}" class="news-image" />
            <div class="news-title" style="background-color: ${color};">${news.title}</div>
            <div class="news-date">${formattedDate}</div>
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
updateSourceBar();
fetchNews();