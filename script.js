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
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderPasswords();
}

// Показать/скрыть пароль
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling?.querySelector('i') || 
                 input.parentElement.querySelector('.eye-btn i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Копирование текста в буфер обмена
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Скопировано в буфер обмена');
        tg.HapticFeedback.impactOccurred('light');
    }).catch(err => {
        showToast('❌ Не удалось скопировать');
    });
}

// Копирование пароля
function copyPassword(id) {
    const password = passwords.find(p => p.id === id);
    if (password && masterPassword) {
        const decrypted = simpleDecrypt(password.password, masterPassword);
        copyText(decrypted);
    }
}

// Показать пароль
function showPassword(id) {
    const password = passwords.find(p => p.id === id);
    if (password && masterPassword) {
        const decrypted = simpleDecrypt(password.password, masterPassword);
        const btn = event.target.closest('button');
        const field = btn.closest('.password-field').querySelector('.field-value');
        
        if (field.textContent === '••••••••') {
            field.textContent = decrypted;
            btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            
            // Автоматически скрыть через 10 секунд
            setTimeout(() => {
                field.textContent = '••••••••';
                btn.innerHTML = '<i class="fas fa-eye"></i>';
            }, 10000);
        } else {
            field.textContent = '••••••••';
            btn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }
}

// Показать форму добавления
function showAddForm() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Добавить новый пароль';
    document.getElementById('passwordForm').reset();
    document.getElementById('category').value = 'social';
    showModal('passwordModal');
}

// Показать форму редактирования
function editPassword(id) {
    const password = passwords.find(p => p.id === id);
    if (!password) return;
    
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать пароль';
    
    document.getElementById('serviceName').value = password.service;
    document.getElementById('username').value = password.username;
    
    if (masterPassword) {
        document.getElementById('password').value = simpleDecrypt(password.password, masterPassword);
    }
    
    document.getElementById('website').value = password.website || '';
    document.getElementById('category').value = password.category;
    document.getElementById('notes').value = password.notes || '';
    
    showModal('passwordModal');
}

// Сохранение пароля
function savePassword(event) {
    event.preventDefault();
    
    const service = document.getElementById('serviceName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const website = document.getElementById('website').value.trim();
    const category = document.getElementById('category').value;
    const notes = document.getElementById('notes').value.trim();
    
    if (!service || !username || !password) {
        showToast('⚠️ Заполните обязательные поля');
        return;
    }
    
    // Шифруем пароль
    const encryptedPassword = simpleEncrypt(password, masterPassword);
    
    const passwordData = {
        id: editingId || Date.now().toString(),
        service,
        username,
        password: encryptedPassword,
        website: website || null,
        category,
        notes: notes || null,
        created: editingId ? passwords.find(p => p.id === editingId)?.created || Date.now() : Date.now(),
        updated: Date.now()
    };
    
    if (editingId) {
        // Обновляем существующий пароль
        const index = passwords.findIndex(p => p.id === editingId);
        if (index !== -1) {
            passwords[index] = passwordData;
        }
    } else {
        // Добавляем новый пароль
        passwords.push(passwordData);
    }
    
    savePasswords();
    updateUI();
    closeModal();
    showToast(editingId ? '✅ Пароль обновлен' : '✅ Пароль добавлен');
}

// Удаление пароля
function deletePassword(id) {
    if (!confirm('Вы уверены, что хотите удалить этот пароль?')) return;
    
    const index = passwords.findIndex(p => p.id === id);
    if (index !== -1) {
        passwords.splice(index, 1);
        savePasswords();
        updateUI();
        showToast('🗑️ Пароль удален');
    }
}

// Блокировка приложения
function lockApp() {
    masterPassword = '';
    document.getElementById('masterPassword').value = '';
    showScreen('loginScreen');
    showToast('🔒 Приложение заблокировано');
}

// Экспорт данных (в зашифрованном виде)
function exportData() {
    if (passwords.length === 0) {
        showToast('📭 Нет данных для экспорта');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: passwords.length,
        data: passwords
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const encrypted = simpleEncrypt(jsonStr, masterPassword);
    
    // Создаем файл для скачивания
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passwords_${new Date().toISOString().split('T')[0]}.enc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('💾 Данные экспортированы');
}

// Генератор паролей
function generatePassword() {
    showModal('generatorModal');
    updateGenerator();
}

function updateGenerator() {
    const length = parseInt(document.getElementById('lengthSlider').value);
    const uppercase = document.getElementById('uppercase').checked;
    const lowercase = document.getElementById('lowercase').checked;
    const numbers = document.getElementById('numbers').checked;
    const symbols = document.getElementById('symbols').checked;
    
    document.getElementById('lengthValue').textContent = length;
    
    // Генерируем пароль
    let charset = '';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (charset === '') {
        document.getElementById('generatedPassword').value = 'Выберите типы символов';
        return;
    }
    
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    document.getElementById('generatedPassword').value = password;
    
    // Обновляем индикатор безопасности
    updateSecurityMeter(password);
}

function updateSecurityMeter(password) {
    let score = 0;
    
    // Длина
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    
    // Разнообразие символов
    if (/[A-Z]/.test(password)) score += 15;
    if (/[a-z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;
    
    score = Math.min(score, 100);
    
    const fill = document.getElementById('meterFill');
    const text = document.getElementById('securityText');
    
    fill.style.width = score + '%';
    
    if (score < 30) {
        fill.style.background = 'var(--danger)';
        text.textContent = 'Слабый';
    } else if (score < 70) {
        fill.style.background = 'var(--warning)';
        text.textContent = 'Средний';
    } else {
        fill.style.background = 'var(--success)';
        text.textContent = 'Сильный';
    }
}

function copyGeneratedPassword() {
    const password = document.getElementById('generatedPassword').value;
    if (password && !password.includes('Выберите')) {
        copyText(password);
    }
}

function useGeneratedPassword() {
    const password = document.getElementById('generatedPassword').value;
    if (password && !password.includes('Выберите')) {
        document.getElementById('password').value = password;
        document.getElementById('password').type = 'text';
        closeGenerator();
        showToast('✅ Пароль скопирован в форму');
    }
}

// Вспомогательные функции
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function closeGenerator() {
    document.getElementById('generatorModal').style.display = 'none';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp);

// Поиск
document.getElementById('searchInput').addEventListener('input', renderPasswords);
