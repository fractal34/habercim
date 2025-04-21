// Kategoriler ve RSS URL'leri (Her kategoriye birden fazla kaynak)
const categoryRssUrls = {
    'Son Dakika': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml',
        'Mynet': 'http://www.mynet.com/haber/rss/sondakika',
    },
    'Spor': {
        'Habertürk': 'http://www.haberturk.com/rss/spor.xml',
    },
    'Magazin': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/magazinrss.xml',
    },
    'Politika': {
        'Mynet': 'https://www.mynet.com/haber/rss/kategori/politika/',
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
    'Ekonomi': {
        'Milliyet': 'https://www.milliyet.com.tr/rss/rssnew/ekonomi.xml',
        'Finansingundemi': 'https://www.finansingundemi.com//rss',
    },
};

const categoryColors = {
    'Son Dakika': '#ff0000',
    'Spor': '#008000',
    'Magazin': '#800080',
    'Dünya': '#ffa500',
    'Gündem': '#0000ff',
    'Politika': '#666',
    'Otomobil': '#00008B',
    'Teknoloji': '#00BFFF',
    'Ekonomi': '#466e98',
};

// CORS proxy URL'si
const corsProxy = 'https://habercim.vercel.app/api/proxy?url=';

// Her kategoriden çekilecek maksimum haber sayısı (Mobil için 10, masaüstü için 50)
const isMobile = window.innerWidth <= 768;
const MAX_NEWS_PER_CATEGORY = isMobile ? 10 : 50;

// Seçili kategoriler ve kaynaklar (localStorage'dan yükle, yoksa varsayılan değerler)
let selectedCategories = JSON.parse(localStorage.getItem('selectedCategories')) || ['Son Dakika'];
let selectedSources = JSON.parse(localStorage.getItem('selectedSources')) || {};
Object.keys(categoryRssUrls).forEach(category => {
    if (!selectedSources[category]) {
        if (category === 'Son Dakika') {
            selectedSources[category] = ['Milliyet'];
        } else {
            selectedSources[category] = [];
        }
    }
});

let allNews = [];
let displayedNewsCount = 50;
let isLoadingMore = false;
let lastRenderedNewsCount = 0;
let lastFetchTime = new Date(); // Yeni haberleri belirlemek için
let countdown = 180; // 180 saniyeden geriye sayacak

// Boyut seviyesini takip etmek için değişken
let sizeLevel = 0; // -2, -1, 0, 1, 2 gibi değerler alacak

// Saat ve sayaç güncellemesi
function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
    // Sayaç güncellemesi
    document.getElementById('countdown').textContent = `${countdown}s`;
    countdown--;
    if (countdown < 0) {
        countdown = 180; // 180 saniyeye sıfırla
        fetchNews(); // Haberleri yenile
    }
}
setInterval(updateClock, 1000);
updateClock();

// Hamburger Menü Kontrolü
const mobileMenu = document.getElementById('mobile-menu');
const hamburgerBtn = document.getElementById('hamburger-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');

hamburgerBtn.addEventListener('click', () => {
    mobileMenu.classList.add('active');
    updateSourceBar(); // Menü açıldığında kaynak barını güncelle
});

closeMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
});

// Ayarlar Menüsü Kontrolü
const settingsMenu = document.getElementById('settings-menu');
const settingsBtn = document.getElementById('settings-btn');

settingsBtn.addEventListener('click', () => {
    settingsMenu.classList.toggle('active');
});

// Kategorileri sıfırlama fonksiyonu
function resetCategories() {
    // Sadece "Son Dakika" kategorisini ve "Milliyet" kaynağını aktif yap
    selectedCategories = ['Son Dakika'];
    selectedSources = {};
    Object.keys(categoryRssUrls).forEach(category => {
        if (category === 'Son Dakika') {
            selectedSources[category] = ['Milliyet'];
        } else {
            selectedSources[category] = [];
        }
    });

    // Arayüzü güncelle
    updateSourceBar();
    fetchNews();

    // localStorage'ı güncelle
    localStorage.setItem('selectedCategories', JSON.stringify(selectedCategories));
    localStorage.setItem('selectedSources', JSON.stringify(selectedSources));
}

// "Kategorileri Sıfırla" butonuna olay dinleyici ekle
document.getElementById('reset-categories').addEventListener('click', resetCategories);
document.getElementById('reset-categories-mobile').addEventListener('click', resetCategories);

// Kaynak seçim barını güncelle (hem masaüstü hem mobil için)
function updateSourceBar() {
    const sourceMenu = document.querySelector('.category-source-menu');
    const mobileCategories = document.getElementById('mobile-categories');

    // Masaüstü için kaynak barını güncelle
    sourceMenu.innerHTML = '<nav class="category-source-title">KAYNAKLAR</nav>';
    // Mobil için menüyü güncelle
    mobileCategories.innerHTML = '';

    // Tüm kategoriler için başlık ve kaynaklar (mobil menüde)
    const allCategories = Object.keys(categoryRssUrls);
    const categoryPairs = [];
    for (let i = 0; i < allCategories.length; i += 2) {
        categoryPairs.push(allCategories.slice(i, i + 2));
    }

    categoryPairs.forEach(pair => {
        const categoryRow = document.createElement('div');
        categoryRow.className = 'category-row';

        pair.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'mobile-category-item';

            // Kategori başlığı (checkbox olmadan)
            const categoryTitle = document.createElement('span');
            categoryTitle.className = 'mobile-category-title';
            categoryTitle.textContent = category.toUpperCase();
            categoryDiv.appendChild(categoryTitle);

            // Kategoriye ait kaynaklar
            const sources = categoryRssUrls[category];
            if (sources) {
                Object.keys(sources).forEach(source => {
                    const sourceLabel = document.createElement('label');
                    sourceLabel.className = 'mobile-source-item';
                    const sourceCheckbox = document.createElement('input');
                    sourceCheckbox.type = 'checkbox';
                    sourceCheckbox.checked = selectedSources[category].includes(source);
                    sourceCheckbox.dataset.category = category;
                    sourceCheckbox.dataset.source = source;

                    sourceCheckbox.addEventListener('change', () => {
                        if (sourceCheckbox.checked) {
                            if (!selectedSources[category].includes(source)) {
                                selectedSources[category].push(source);
                            }
                            if (!selectedCategories.includes(category)) {
                                selectedCategories.push(category);
                            }
                        } else {
                            selectedSources[category] = selectedSources[category].filter(s => s !== source);
                            if (selectedSources[category].length === 0) {
                                selectedCategories = selectedCategories.filter(cat => cat !== category);
                            }
                        }
                        updateSourceBar();
                        fetchNews();
                    });

                    sourceLabel.appendChild(sourceCheckbox);
                    sourceLabel.appendChild(document.createTextNode(source));
                    categoryDiv.appendChild(sourceLabel);
                });
            }

            categoryRow.appendChild(categoryDiv);
        });

        mobileCategories.appendChild(categoryRow);
    });

    // Masaüstü için sadece seçili kategorilerin kaynaklarını göster
    selectedCategories.forEach(category => {
        const sources = categoryRssUrls[category];
        if (!sources) return;

        const categoryTitle = document.createElement('span');
        categoryTitle.className = 'category-source-title';
        categoryTitle.textContent = ` - ${category.toUpperCase()}: `;
        sourceMenu.appendChild(categoryTitle);

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

    // Masaüstü kategori butonlarını güncelle
    document.querySelectorAll('.category-btn').forEach(btn => {
        if (selectedCategories.includes(btn.dataset.category)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Seçimleri localStorage'a kaydet
    localStorage.setItem('selectedCategories', JSON.stringify(selectedCategories));
    localStorage.setItem('selectedSources', JSON.stringify(selectedSources));
}

// Kategori butonlarını dinle
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', () => {
        const category = button.dataset.category;
        if (selectedCategories.includes(category)) {
            selectedCategories = selectedCategories.filter(cat => cat !== category);
            selectedSources[category] = []; // Kategori seçimi kalkarsa kaynaklar da sıfırlanır
        } else {
            selectedCategories.push(category);
            // Varsayılan olarak tüm kaynakları seçili yap
            selectedSources[category] = Object.keys(categoryRssUrls[category]);
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
        // Seçimleri localStorage'a kaydet
        localStorage.setItem('selectedCategories', JSON.stringify(selectedCategories));
        localStorage.setItem('selectedSources', JSON.stringify(selectedSources));
    });
});

// Tarih ayrıştırma fonksiyonu (iPhone uyumluluğu için)
function parsePubDate(pubDateStr) {
    if (!pubDateStr) {
        console.warn('No pubDate provided, using current date as fallback');
        return new Date();
    }

    // Önce doğrudan Date ile dene
    let parsedDate = new Date(pubDateStr);
    if (!isNaN(parsedDate)) {
        return parsedDate;
    }

    // Eğer başarısızsa, formatı elle ayrıştır
    // Örnek format: "Tue, 15 Oct 2024 12:34:56 +0300" (RFC 2822)
    // veya "2024-10-15T12:34:56+03:00" (ISO 8601)
    try {
        // RFC 2822 formatını elle ayrıştır
        const parts = pubDateStr.match(/(\w+), (\d+) (\w+) (\d+) (\d+):(\d+):(\d+)(?:\s+\+(\d+))?/);
        if (parts) {
            const [, , day, monthStr, year, hour, minute, second, offset] = parts;
            const months = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            const month = months[monthStr];
            if (month === undefined) throw new Error('Invalid month');
            parsedDate = new Date(Date.UTC(year, month, day, hour, minute, second));
            if (offset) {
                const offsetHours = parseInt(offset.slice(0, 2), 10);
                const offsetMinutes = parseInt(offset.slice(2), 10);
                const offsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;
                parsedDate = new Date(parsedDate.getTime() - offsetMs);
            }
            if (!isNaN(parsedDate)) return parsedDate;
        }

        // ISO 8601 formatını dene
        if (pubDateStr.includes('T')) {
            parsedDate = new Date(pubDateStr);
            if (!isNaN(parsedDate)) return parsedDate;
        }

        // Eğer hala başarısızsa, hata logla ve geçerli bir tarih döndür
        console.warn(`Unable to parse pubDate: ${pubDateStr}, using current date as fallback`);
        return new Date();
    } catch (error) {
        console.error(`Error parsing pubDate: ${pubDateStr}, Error: ${error.message}`);
        return new Date();
    }
}

// Boyut değiştirme fonksiyonu
function updateNewsSize() {
    const newsItems = document.querySelectorAll('.news-item');
    const baseHeight = isMobile ? 170 : 220; // Mobil için 170px (4 satır başlık için artırıldı), masaüstü için 220px
    const baseImageHeight = isMobile ? 60 : 110; // Mobil için 60px, masaüstü için 110px
    const baseTitleFontSize = isMobile ? 12 : 13; // Mobil için 12px, masaüstü için 13px
    const baseDateFontSize = isMobile ? 10 : 11; // Mobil için 10px, masaüstü için 11px

    const heightIncrement = 10; // Her seviyede yükseklik artışı
    const fontSizeIncrement = 1; // Her seviyede yazı boyutu artışı

    const newHeight = baseHeight + (sizeLevel * heightIncrement);
    const newImageHeight = baseImageHeight + (sizeLevel * heightIncrement / 2);
    const newTitleFontSize = baseTitleFontSize + (sizeLevel * fontSizeIncrement);
    const newDateFontSize = baseDateFontSize + (sizeLevel * fontSizeIncrement);

    newsItems.forEach(item => {
        item.style.height = `${newHeight}px`;
        const image = item.querySelector('.news-image');
        const title = item.querySelector('.news-title');
        const date = item.querySelector('.news-date');

        if (image) image.style.height = `${newImageHeight}px`;
        if (title) title.style.fontSize = `${newTitleFontSize}px`;
        if (date) date.style.fontSize = `${newDateFontSize}px`;
    });

    // Grid boyutlarını güncellemek için min genişliği de artır
    const newsList = document.getElementById('news-list');
    const baseMinWidth = isMobile ? 100 : 160; // Mobil için 100px, masaüstü için 160px
    const newMinWidth = baseMinWidth + (sizeLevel * heightIncrement);
    newsList.style.gridTemplateColumns = `repeat(auto-fill, minmax(${newMinWidth}px, 1fr))`;
}

// Boyut artırma ve azaltma butonları (Masaüstü ve Mobil)
document.getElementById('increase-size').addEventListener('click', () => {
    if (sizeLevel < 2) {
        sizeLevel++;
        updateNewsSize();
    }
});

document.getElementById('decrease-size').addEventListener('click', () => {
    if (sizeLevel > -2) {
        sizeLevel--;
        updateNewsSize();
    }
});

document.getElementById('increase-size-mobile').addEventListener('click', () => {
    if (sizeLevel < 2) {
        sizeLevel++;
        updateNewsSize();
    }
});

document.getElementById('decrease-size-mobile').addEventListener('click', () => {
    if (sizeLevel > -2) {
        sizeLevel--;
        updateNewsSize();
    }
});

// RSS'ten haberleri çek
async function fetchNews() {
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = '<p>Haberlerin yüklenme süresi seçtiğiniz kategori sayısına göre değişebilir. Beklediğiniz için teşekkürler.</p>';
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

                const now = new Date();
                const threeDaysInMs = 72 * 60 * 60 * 1000; // 72 saat (3 gün) milisaniye cinsinden

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
                    } else if (link.includes('mynet.com')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'mynet-';
                    } else if (link.includes('finansingundemi.com')) {
                        const match = link.match(/(\d+)$/);
                        newsId = match ? match[0] : link;
                        sourcePrefix = 'finansingundemi-';
                    } else {
                        newsId = link;
                        sourcePrefix = 'unknown-';
                    }

                    // Benzersiz bir anahtar oluştur
                    const title = item.querySelector('title')?.textContent || 'Başlık Yok';
                    const pubDateStr = item.querySelector('pubDate')?.textContent;
                    const pubDate = parsePubDate(pubDateStr);

                    // 72 saatten eski haberleri filtrele
                    if ((now - pubDate) > threeDaysInMs) {
                        console.log(`Skipping old news item: ${title}, Date: ${pubDate}`);
                        return;
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
                            console.log(`Image found in description for ${source}: ${imageUrl}`);
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
                        const imageElement = item.querySelector('image')?.textContent || '';
                        if (imageElement) {
                            imageUrl = imageElement;
                            console.log(`Image found in <image> tag for ${source}: ${imageUrl}`);
                        }
                    }
                    if (!imageUrl) {
                        console.log(`No image found for item in ${category} from ${source}, link: ${link}`);
                        imageUrl = 'https://via.placeholder.com/150'; // Placeholder
                    }

                    const currentTime = new Date();
                    const thirtyMinutes = 30 * 60 * 1000; // 30 dakika milisaniye cinsinden
                    const isNew = pubDate > lastFetchTime;
                    const newLabelUntil = isNew ? new Date(currentTime.getTime() + thirtyMinutes) : null;

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
                               link.includes('mynet') ? 'mynet' : 
                               link.includes('finansingundemi') ? 'finansingundemi' : 'unknown',
                        newLabelUntil: newLabelUntil // 30 dakika boyunca "Yeni" etiketi göster
                    };

                    console.log(`Adding news item to ${category} from ${source}: ${title}, Link: ${link}, Image: ${imageUrl}, Unique Key: ${uniqueKey}, Source: ${newsItem.source}, Date: ${pubDate}, New Until: ${newsItem.newLabelUntil}`);

                    if (!newsById.has(uniqueKey)) {
                        newsById.set(uniqueKey, newsItem);
                        allNews.push(newsItem);
                    } else {
                        const existing = newsById.get(uniqueKey);
                        if (!existing.categories.includes(category)) {
                            existing.categories.push(category);
                        }
                        // Eğer mevcut haber zaten varsa ve yeni geldiyse newLabelUntil güncelle
                        if (isNew) {
                            existing.newLabelUntil = new Date(currentTime.getTime() + thirtyMinutes);
                        }
                    }
                });
            }
        }

        console.log(`Total news items in allNews: ${allNews.length}`);
        if (allNews.length > 0) {
            console.log(`First news item: ${JSON.stringify(allNews[0])}`);
        }

        // lastFetchTime'ı güncelle
        lastFetchTime = new Date();

        // Tarihe göre sırala (en yeniden eskiye)
        allNews.sort((a, b) => {
            const dateA = a.date.getTime();
            const dateB = b.date.getTime();
            if (isNaN(dateA) || isNaN(dateB)) {
                console.warn(`Invalid date detected during sorting: A: ${a.date}, B: ${b.date}`);
                return 0;
            }
            return dateB - dateA;
        });

        console.log('First few news after sorting:');
        allNews.slice(0, 5).forEach((news, index) => {
            console.log(`News ${index + 1}: ${news.title}, Date: ${news.date}, Categories: ${news.categories}, Link: ${news.link}, Source: ${news.source}, New Until: ${news.newLabelUntil}`);
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

    const now = new Date();

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

        const isNew = news.newLabelUntil && now < news.newLabelUntil;

        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        newsItem.style.backgroundColor = color;
        if (isMobile) {
            newsItem.classList.add('mobile-news-item');
            newsItem.innerHTML = `
                <img src="${news.imageUrl || 'https://via.placeholder.com/150'}" alt="${news.title}" class="news-image" />
                ${isNew ? '<div class="news-new">Yeni</div>' : ''}
                <div class="news-title" style="background-color: ${color};">${news.title}</div>
                <div class="news-date">${formattedDate}</div>
            `;
        } else {
            newsItem.innerHTML = `
                <img src="${news.imageUrl || 'https://via.placeholder.com/150'}" alt="${news.title}" class="news-image" />
                ${isNew ? '<div class="news-new">Yeni</div>' : ''}
                <div class="news-title" style="background-color: ${color};">${news.title}</div>
                <div class="news-date">${formattedDate}</div>
            `;
        }
        newsItem.addEventListener('click', () => showNewsDetail(news));
        newsList.appendChild(newsItem);
    });

    lastRenderedNewsCount = displayedNewsCount;

    // Boyutları güncelle
    updateNewsSize();

    console.log(`Total news: ${allNews.length}, Displayed news: ${displayedNewsCount}, Last rendered: ${lastRenderedNewsCount}`);
}

// Haber detaylarını göster
function showNewsDetail(news) {
    let url = news.link;
    console.log(`Original URL: ${url}, Source: ${news.source}`);

    if (!url || !url.startsWith('http')) {
        console.error(`Invalid URL: ${url}`);
        return;
    }

    const displayUrl = url;
    console.log(`Loading URL: ${displayUrl}`);

    if (isMobile) {
        const newsDetailOverlay = document.getElementById('news-detail-overlay');
        newsDetailOverlay.innerHTML = `
            <div class="header-frame">
                <button id="close-overlay-btn" class="close-overlay-btn">← Geri</button>
            </div>
            <iframe id="news-iframe-overlay" name="news-iframe-overlay" frameborder="0" style="width:100%; height:100%;"
                onload="console.log('Iframe loaded successfully: ${displayUrl}')"
                onerror="console.error('Iframe failed to load: ${displayUrl}, Error: ' + (this.contentDocument || this.contentWindow.document || 'Unknown error')); this.style.display='none'; this.parentElement.innerHTML='<p>Bu haber iframe içinde gösterilemiyor: ${news.source === 'milliyet' ? 'Milliyet haberleri iframe içinde açılamıyor (X-Frame-Options kısıtlaması). Lütfen başka bir haber seçin.' : 'Bilinmeyen bir hata oluştu.'}</p>';">
            </iframe>
        `;
        const iframe = newsDetailOverlay.querySelector('iframe');
        iframe.src = displayUrl;
        newsDetailOverlay.classList.add('active');

        const closeOverlayBtn = document.getElementById('close-overlay-btn');
        closeOverlayBtn.addEventListener('click', () => {
            newsDetailOverlay.classList.remove('active');
        });
    } else {
        const newsDetail = document.getElementById('news-detail');
        newsDetail.innerHTML = `
            <iframe src="${displayUrl}" frameborder="0" style="width: 100%; height: 100%;"
                onload="console.log('Iframe loaded successfully: ${displayUrl}')"
                onerror="console.error('Iframe failed to load: ${displayUrl}, Error: ' + (this.contentDocument || this.contentWindow.document || 'Unknown error')); this.style.display='none'; this.parentElement.innerHTML='<p>Bu haber iframe içinde gösterilemiyor: ${news.source === 'milliyet' ? 'Milliyet haberleri iframe içinde açılamıyor (X-Frame-Options kısıtlaması). Lütfen başka bir haber seçin.' : 'Bilinmeyen bir hata oluştu.'}</p>';">
            </iframe>
        `;
    }
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