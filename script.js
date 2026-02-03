// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран

// Получаем данные пользователя
const user = tg.initDataUnsafe.user;

// Ключевые переменные
let masterPassword = '';
let passwords = [];
let currentCategory = 'all';
let editingId = null;

// Простое шифрование (для демонстрации)
// В реальном приложении используйте более надежные методы
function simpleEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
}

function simpleDecrypt(text, key) {
    try {
        const decoded = atob(text);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch (e) {
        return '';
    }
}

// Инициализация приложения
function initApp() {
    // Проверяем, есть ли сохраненный мастер-пароль
    const savedHash = localStorage.getItem('mp_hash');
    
    if (savedHash) {
        // Показываем экран входа
        showScreen('loginScreen');
    } else {
        // Первый запуск - создаем мастер-пароль
        createMasterPassword();
    }
    
    // Настраиваем основную кнопку Telegram
    tg.MainButton.setText("Добавить пароль");
    tg.MainButton.show();
    tg.MainButton.onClick(showAddForm);
    
    console.log('Менеджер паролей загружен!');
}

// Создание мастер-пароля (первый запуск)
function createMasterPassword() {
    const password = prompt('Создайте мастер-пароль для защиты ваших данных:');
    
    if (password && password.length >= 6) {
        // Сохраняем хэш пароля
        const hash = btoa(password + '_' + Date.now());
        localStorage.setItem('mp_hash', hash);
        
        masterPassword = password;
        showScreen('mainScreen');
        loadPasswords();
        
        showToast('✅ Мастер-пароль создан! Запомните его.');
    } else if (password) {
        alert('Пароль должен содержать минимум 6 символов');
        createMasterPassword();
    }
}

// Вход в приложение
function login() {
    const input = document.getElementById('masterPassword').value;
    
    if (!input) {
        showToast('⚠️ Введите пароль');
        return;
    }
    
    const savedHash = localStorage.getItem('mp_hash');
    if (!savedHash) {
        // Нет сохраненного пароля
        masterPassword = input;
        localStorage.setItem('mp_hash', btoa(input + '_' + Date.now()));
        showScreen('mainScreen');
        loadPasswords();
        showToast('✅ Добро пожаловать!');
        return;
    }
    
    // Проверяем пароль
    try {
        const decoded = atob(savedHash);
        const savedPassword = decoded.split('_')[0];
        
        if (input === savedPassword) {
            masterPassword = input;
            showScreen('mainScreen');
            loadPasswords();
            showToast('✅ Доступ разрешен!');
        } else {
            showToast('❌ Неверный пароль');
            document.getElementById('masterPassword').value = '';
        }
    } catch (e) {
        showToast('❌ Ошибка при проверке пароля');
    }
}

// Загрузка паролей из localStorage
function loadPasswords() {
    try {
        const encrypted = localStorage.getItem('passwords_data');
        if (encrypted && masterPassword) {
            const decrypted = simpleDecrypt(encrypted, masterPassword);
            passwords = JSON.parse(decrypted || '[]');
        } else {
            passwords = [];
        }
        updateUI();
    } catch (e) {
        console.error('Ошибка загрузки паролей:', e);
        passwords = [];
        updateUI();
    }
}

// Сохранение паролей в localStorage
function savePasswords() {
    try {
        if (!masterPassword) return;
        
        const data = JSON.stringify(passwords);
        const encrypted = simpleEncrypt(data, masterPassword);
        localStorage.setItem('passwords_data', encrypted);
        
        // Также сохраняем последнюю активность
        localStorage.setItem('last_activity', Date.now());
    } catch (e) {
        console.error('Ошибка сохранения паролей:', e);
    }
}

// Обновление интерфейса
function updateUI() {
    // Обновляем статистику
    document.getElementById('totalPasswords').textContent = passwords.length;
    
    // Рассчитываем уровень безопасности
    let securityScore = 0;
    if (passwords.length > 0) {
        const strongPasswords = passwords.filter(p => {
            const pass = simpleDecrypt(p.password, masterPassword);
            return pass.length >= 12 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass);
        }).length;
        securityScore = Math.round((strongPasswords / passwords.length) * 100);
    }
    document.getElementById('securityScore').textContent = securityScore + '%';
    
    // Обновляем список паролей
    renderPasswords();
}

// Отображение списка паролей
function renderPasswords() {
    const list = document.getElementById('passwordsList');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    // Фильтруем пароли
    let filtered = passwords;
    
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }
    
    if (searchQuery) {
        filtered = filtered.filter(p => 
            p.service.toLowerCase().includes(searchQuery) || 
            p.username.toLowerCase().includes(searchQuery)
        );
    }
    
    // Сортируем по алфавиту
    filtered.sort((a, b) => a.service.localeCompare(b.service));
    
    // Отображаем
    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-key" style="font-size: 48px; color: var(--secondary); margin-bottom: 20px;"></i>
                <h3>Пароли не найдены</h3>
                <p>${searchQuery ? 'Попробуйте другой запрос' : 'Добавьте ваш первый пароль'}</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = filtered.map(password => `
        <div class="password-item" data-id="${password.id}">
            <div class="password-header">
                <div class="service-name">
                    <i class="fas fa-${getServiceIcon(password.category)}"></i>
                    ${password.service}
                    <span class="category-tag">${getCategoryName(password.category)}</span>
                </div>
                <div class="password-actions">
                    <button class="copy-btn" onclick="copyPassword('${password.id}')" title="Копировать пароль">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="copy-btn" onclick="editPassword('${password.id}')" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="copy-btn" onclick="deletePassword('${password.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="password-content">
                <div class="password-field">
                    <div>
                        <div class="field-label">Логин</div>
                        <div class="field-value">${password.username}</div>
                    </div>
                    <button class="copy-btn" onclick="copyText('${password.username}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="password-field">
                    <div>
                        <div class="field-label">Пароль</div>
                        <div class="field-value">••••••••</div>
                    </div>
                    <button class="copy-btn" onclick="showPassword('${password.id}')" title="Показать пароль">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            ${password.website ? `<div class="website">
                <i class="fas fa-link"></i> 
                <a href="${password.website}" target="_blank">${password.website}</a>
            </div>` : ''}
            ${password.notes ? `<div class="notes">${password.notes}</div>` : ''}
        </div>
    `).join('');
}

// Получение иконки для сервиса
function getServiceIcon(category) {
    const icons = {
        'social': 'users',
        'games': 'gamepad',
        'bank': 'university',
        'email': 'envelope',
        'work': 'briefcase',
        'other': 'key'
    };
    return icons[category] || 'key';
}

// Получение названия категории
function getCategoryName(category) {
    const names = {
        'social': 'Соцсети',
        'games': 'Игры',
        'bank': 'Банки',
        'email': 'Почта',
        'work': 'Работа',
        'other': 'Другое'
    };
    return names[category] || 'Другое';
}

// Фильтрация по категории
function filterByCategory(category) {
    currentCategory = category;
    
    // Обновляем активные кнопки
    document.querySelectorAll('.category-btn').forEach(btn
