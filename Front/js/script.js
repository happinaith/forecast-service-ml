/**
 * CurrencyForecast - Frontend для ML-сервиса прогнозирования курса валют
 * GitHub проекта: https://github.com/happinaith/forecast-service-ml
 */

class CurrencyForecastApp {
    constructor() {
        // Конфигурация API сервера ML-модели
        this.API_CONFIG = {
            // Базовый URL API сервера (замените на ваш реальный URL)
            BASE_URL: 'http://localhost:8000', // Или 'https://ваш-сервер.com'
            ENDPOINTS: {
                HEALTH: '/api/health',
                HISTORICAL: '/api/historical',
                FORECAST: '/api/forecast'
            },
            // Время ожидания ответа от сервера (мс)
            TIMEOUT: 10000,
            // Режим демо (использовать мок-данные если true)
            DEMO_MODE: true
        };

        // Инициализация элементов интерфейса
        this.elements = {
            // Навигация
            navLinks: document.querySelectorAll('.nav-link'),
            loginBtn: document.querySelector('.btn-outline'),
            
            // Управление данными
            currencyPairSelect: document.getElementById('currency-pair-select'),
            forecastDaysSelect: document.getElementById('forecast-days'),
            startDateInput: document.getElementById('start-date'),
            endDateInput: document.getElementById('end-date'),
            fetchDataBtn: document.getElementById('fetch-data-btn'),
            getForecastBtn: document.getElementById('get-forecast-btn'),
            resetBtn: document.getElementById('reset-btn'),
            
            // Статус
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            
            // Загрузка
            loadingElement: document.getElementById('loading'),
            loadingDetails: document.getElementById('loading-details'),
            
            // Управление графиком
            toggleHistorical: document.getElementById('toggle-historical'),
            toggleForecast: document.getElementById('toggle-forecast'),
            toggleBoth: document.getElementById('toggle-both'),
            
            // Чарт
            chartCanvas: document.getElementById('currency-chart')
        };

        // Состояние приложения
        this.state = {
            historicalData: [],
            forecastData: [],
            currentView: 'both',
            isConnected: false,
            isLoading: false,
            currencyPair: 'USD_RUB',
            forecastDays: 14
        };

        // Экземпляр графика
        this.chart = null;
        
        // Цвета для графиков (соответствуют стилям JetBrains)
        this.chartColors = {
            historical: {
                border: '#1E88E5',
                background: 'rgba(30, 136, 229, 0.1)',
                point: '#1E88E5'
            },
            forecast: {
                border: '#43A047',
                background: 'rgba(67, 160, 71, 0.1)',
                point: '#43A047'
            }
        };
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('🚀 CurrencyForecast App Initializing...');
        console.log('📚 GitHub проекта: https://github.com/happinaith/forecast-service-ml');
        
        try {
            // Настройка интерфейса
            this.setupUI();
            
            // Инициализация дат
            this.setupDates();
            
            // Инициализация графика
            this.initChart();
            
            // Проверка подключения к серверу
            await this.checkServerConnection();
            
            // Настройка обработчиков событий
            this.setupEventListeners();
            
            console.log('✅ Приложение успешно инициализировано');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Ошибка инициализации приложения');
        }
    }

    /**
     * Настройка пользовательского интерфейса
     */
    setupUI() {
        // Активация текущей навигационной ссылки
        this.elements.navLinks.forEach(link => {
            if (link.getAttribute('href') === '#') {
                link.classList.add('active');
            }
        });

        // Обновление статуса кнопок
        this.updateButtonStates();
    }

    /**
     * Настройка дат по умолчанию
     */
    setupDates() {
        const today = new Date();
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        
        // Форматирование дат для input
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        // Установка значений
        this.elements.startDateInput.value = formatDate(monthAgo);
        this.elements.endDateInput.value = formatDate(today);
        
        // Установка ограничений
        const minDate = new Date(today);
        minDate.setFullYear(minDate.getFullYear() - 1);
        this.elements.startDateInput.min = formatDate(minDate);
        this.elements.startDateInput.max = formatDate(today);
        
        this.elements.endDateInput.min = formatDate(minDate);
        this.elements.endDateInput.max = formatDate(today);
    }

    /**
     * Инициализация графика
     */
    initChart() {
        const ctx = this.elements.chartCanvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        id: 'historical',
                        label: 'Исторические данные',
                        data: [],
                        borderColor: this.chartColors.historical.border,
                        backgroundColor: this.chartColors.historical.background,
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: this.chartColors.historical.point,
                        fill: true
                    },
                    {
                        id: 'forecast',
                        label: 'Прогноз ML-модели',
                        data: [],
                        borderColor: this.chartColors.forecast.border,
                        backgroundColor: this.chartColors.forecast.background,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: this.chartColors.forecast.point,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 13,
                                family: "'Segoe UI', 'Roboto', sans-serif"
                            },
                            color: '#212121'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(33, 33, 33, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${value.toFixed(4)}`;
                            },
                            title: (items) => {
                                if (items.length > 0) {
                                    const date = new Date(items[0].parsed.x);
                                    return date.toLocaleDateString('ru-RU', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    });
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd.MM.yy'
                            },
                            tooltipFormat: 'dd.MM.yyyy'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#616161',
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {
                            display: true,
                            text: 'Дата',
                            color: '#616161',
                            font: {
                                size: 13,
                                weight: '600'
                            },
                            padding: { top: 10 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#616161',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Курс',
                            color: '#616161',
                            font: {
                                size: 13,
                                weight: '600'
                            },
                            padding: { bottom: 10 }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        console.log('📊 График инициализирован');
    }

    /**
     * Проверка подключения к серверу
     */
    async checkServerConnection() {
        this.updateStatus('🔍 Проверка подключения к ML-серверу...', 'checking');
        
        if (this.API_CONFIG.DEMO_MODE) {
            // Демо-режим: имитация успешного подключения
            setTimeout(() => {
                this.state.isConnected = true;
                this.updateStatus('✅ Подключено к ML-серверу (демо-режим)', 'connected');
                this.updateButtonStates();
            }, 1500);
            return;
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.API_CONFIG.TIMEOUT);
            
            const response = await fetch(
                `${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.HEALTH}`,
                {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.state.isConnected = true;
                this.updateStatus(`✅ Сервер доступен | Модель: ${data.model_status || 'активна'}`, 'connected');
            } else {
                this.state.isConnected = false;
                this.updateStatus('⚠️ Сервер недоступен', 'disconnected');
            }
        } catch (error) {
            console.error('Ошибка подключения:', error);
            this.state.isConnected = false;
            this.updateStatus('❌ Не удалось подключиться к серверу', 'disconnected');
        }
        
        this.updateButtonStates();
    }

    /**
     * Обновление статуса подключения
     */
    updateStatus(message, status) {
        this.elements.statusText.textContent = message;
        this.elements.statusIndicator.className = 'status-indicator';
        
        switch (status) {
            case 'connected':
                this.elements.statusIndicator.classList.add('connected');
                break;
            case 'disconnected':
                this.elements.statusIndicator.classList.add('disconnected');
                break;
            case 'checking':
                // Оставляем стандартный цвет (оранжевый)
                break;
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Кнопки навигации
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.elements.navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Кнопка входа
        this.elements.loginBtn?.addEventListener('click', () => {
            alert('Функционал входа будет реализован позже');
        });

        // Кнопка загрузки исторических данных
        this.elements.fetchDataBtn.addEventListener('click', () => this.fetchHistoricalData());

        // Кнопка получения прогноза
        this.elements.getForecastBtn.addEventListener('click', () => this.getForecast());

        // Кнопка сброса
        this.elements.resetBtn.addEventListener('click', () => this.resetForm());

        // Управление видом графика
        this.elements.toggleHistorical.addEventListener('click', () => this.toggleChartView('historical'));
        this.elements.toggleForecast.addEventListener('click', () => this.toggleChartView('forecast'));
        this.elements.toggleBoth.addEventListener('click', () => this.toggleChartView('both'));

        // Изменение валютной пары
        this.elements.currencyPairSelect.addEventListener('change', (e) => {
            this.state.currencyPair = e.target.value;
        });

        // Изменение периода прогноза
        this.elements.forecastDaysSelect.addEventListener('change', (e) => {
            this.state.forecastDays = parseInt(e.target.value);
        });

        console.log('🎯 Обработчики событий настроены');
    }

    /**
     * Обновление состояния кнопок
     */
    updateButtonStates() {
        const canFetch = this.state.isConnected && !this.state.isLoading;
        const canForecast = this.state.isConnected && !this.state.isLoading && this.state.historicalData.length > 0;
        
        this.elements.fetchDataBtn.disabled = !canFetch;
        this.elements.getForecastBtn.disabled = !canForecast;
        this.elements.resetBtn.disabled = this.state.isLoading;
        
        // Визуальная обратная связь
        if (canFetch) {
            this.elements.fetchDataBtn.classList.remove('disabled');
            this.elements.fetchDataBtn.innerHTML = '<i class="fas fa-download"></i> Загрузить данные';
        } else {
            this.elements.fetchDataBtn.classList.add('disabled');
        }
        
        if (canForecast) {
            this.elements.getForecastBtn.classList.remove('disabled');
            this.elements.getForecastBtn.innerHTML = '<i class="fas fa-brain"></i> Получить прогноз';
        } else {
            this.elements.getForecastBtn.classList.add('disabled');
        }
    }

    /**
     * Загрузка исторических данных
     */
    async fetchHistoricalData() {
        if (this.state.isLoading) return;
        
        const currencyPair = this.elements.currencyPairSelect.value;
        const startDate = this.elements.startDateInput.value;
        const endDate = this.elements.endDateInput.value;
        
        if (!currencyPair || !startDate || !endDate) {
            this.showError('Пожалуйста, заполните все поля');
            return;
        }
        
        // Проверка корректности дат
        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Начальная дата не может быть позже конечной');
            return;
        }
        
        this.showLoading(`Загрузка данных для ${currencyPair}...`);
        this.state.isLoading = true;
        this.updateButtonStates();
        
        try {
            let data;
            
            if (this.API_CONFIG.DEMO_MODE) {
                // Демо-режим: генерируем тестовые данные
                data = await this.generateDemoHistoricalData(currencyPair, startDate, endDate);
            } else {
                // Реальный запрос к API
                data = await this.fetchFromAPI('historical', {
                    currency_pair: currencyPair,
                    start_date: startDate,
                    end_date: endDate
                });
            }
            
            this.state.historicalData = data;
            this.updateChartWithData('historical', data);
            this.hideLoading();
            
            // Показываем уведомление об успехе
            this.showSuccess(`Загружено ${data.length} точек данных`);
            
            console.log('📈 Исторические данные загружены:', data);
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showError(`Ошибка загрузки данных: ${error.message}`);
            this.hideLoading();
        }
        
        this.state.isLoading = false;
        this.updateButtonStates();
    }

    /**
     * Получение прогноза от ML-модели
     */
    async getForecast() {
        if (this.state.isLoading || this.state.historicalData.length === 0) return;
        
        const currencyPair = this.elements.currencyPairSelect.value;
        const forecastDays = parseInt(this.elements.forecastDaysSelect.value);
        
        this.showLoading(`Генерация прогноза на ${forecastDays} дней...`);
        this.state.isLoading = true;
        this.updateButtonStates();
        
        try {
            let forecastData;
            
            if (this.API_CONFIG.DEMO_MODE) {
                // Демо-режим: генерируем тестовый прогноз
                forecastData = await this.generateDemoForecastData(
                    currencyPair, 
                    forecastDays, 
                    this.state.historicalData
                );
            } else {
                // Реальный запрос к API
                forecastData = await this.fetchFromAPI('forecast', {
                    currency_pair: currencyPair,
                    forecast_days: forecastDays,
                    historical_data: this.state.historicalData
                });
            }
            
            this.state.forecastData = forecastData;
            this.updateChartWithData('forecast', forecastData);
            this.hideLoading();
            
            // Показываем уведомление об успехе
            this.showSuccess(`Прогноз сгенерирован на ${forecastDays} дней`);
            
            // Активируем вид "оба графика"
            this.toggleChartView('both');
            
            console.log('🔮 Прогноз сгенерирован:', forecastData);
            
        } catch (error) {
            console.error('Ошибка получения прогноза:', error);
            this.showError(`Ошибка получения прогноза: ${error.message}`);
            this.hideLoading();
        }
        
        this.state.isLoading = false;
        this.updateButtonStates();
    }

    /**
     * Генерация демо исторических данных
     */
    async generateDemoHistoricalData(currencyPair, startDate, endDate) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                
                const data = [];
                let currentValue = 70 + Math.random() * 10; // Начальное значение курса
                
                for (let i = 0; i <= daysDiff; i++) {
                    const date = new Date(start);
                    date.setDate(start.getDate() + i);
                    
                    // Генерация реалистичного изменения курса
                    const volatility = 0.02; // Волатильность 2%
                    const change = (Math.random() - 0.5) * 2 * volatility;
                    currentValue *= (1 + change);
                    
                    // Добавляем небольшую тенденцию
                    const trend = 0.0001; // Минимальный дневной тренд
                    currentValue *= (1 + trend);
                    
                    // Ограничиваем значения разумными пределами
                    currentValue = Math.max(50, Math.min(150, currentValue));
                    
                    data.push({
                        date: date.toISOString().split('T')[0],
                        value: parseFloat(currentValue.toFixed(4)),
                        currency_pair: currencyPair
                    });
                }
                
                resolve(data);
            }, 2000); // Имитация задержки сети
        });
    }

    /**
     * Генерация демо прогноза
     */
    async generateDemoForecastData(currencyPair, forecastDays, historicalData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!historicalData || historicalData.length === 0) {
                    resolve([]);
                    return;
                }
                
                const forecastData = [];
                const lastHistoricalPoint = historicalData[historicalData.length - 1];
                const lastDate = new Date(lastHistoricalPoint.date);
                let currentValue = lastHistoricalPoint.value;
                
                // Анализируем исторические данные для создания более реалистичного прогноза
                const recentData = historicalData.slice(-30); // Последние 30 точек
                const avgChange = recentData.reduce((sum, point, idx) => {
                    if (idx === 0) return 0;
                    const prev = recentData[idx - 1].value;
                    return sum + ((point.value - prev) / prev);
                }, 0) / (recentData.length - 1);
                
                const volatility = 0.015; // Прогнозная волатильность 1.5%
                
                for (let i = 1; i <= forecastDays; i++) {
                    const date = new Date(lastDate);
                    date.setDate(lastDate.getDate() + i);
                    
                    // Генерация прогноза с учетом тренда и волатильности
                    const randomChange = (Math.random() - 0.5) * 2 * volatility;
                    const trendChange = avgChange * 0.7; // Ослабленный тренд
                    currentValue *= (1 + trendChange + randomChange);
                    
                    // Ограничиваем значения
                    const minValue = lastHistoricalPoint.value * 0.8;
                    const maxValue = lastHistoricalPoint.value * 1.2;
                    currentValue = Math.max(minValue, Math.min(maxValue, currentValue));
                    
                    forecastData.push({
                        date: date.toISOString().split('T')[0],
                        value: parseFloat(currentValue.toFixed(4)),
                        currency_pair: currencyPair,
                        confidence: 0.85 - (i * 0.01) // Уверенность уменьшается со временем
                    });
                }
                
                resolve(forecastData);
            }, 2500); // Имитация времени обработки ML-моделью
        });
    }

    /**
     * Запрос к реальному API
     */
    async fetchFromAPI(endpoint, params) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.API_CONFIG.TIMEOUT);
        
        try {
            let url, options;
            
            if (endpoint === 'historical') {
                url = `${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.HISTORICAL}/${params.currency_pair}`;
                url += `?start_date=${params.start_date}&end_date=${params.end_date}`;
                options = {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                };
            } else if (endpoint === 'forecast') {
                url = `${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.FORECAST}`;
                options = {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        currency_pair: params.currency_pair,
                        forecast_days: params.forecast_days,
                        historical_data: params.historical_data
                    })
                };
            }
            
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Валидация полученных данных
            if (!data || (endpoint === 'historical' && !data.historical_data) || 
                (endpoint === 'forecast' && !data.forecast_data)) {
                throw new Error('Некорректный формат ответа от сервера');
            }
            
            return endpoint === 'historical' ? data.historical_data : data.forecast_data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Обновление графика данными
     */
    updateChartWithData(type, data) {
        if (!this.chart) return;
        
        const datasetIndex = type === 'historical' ? 0 : 1;
        
        // Преобразуем данные в формат Chart.js
        const chartData = data.map(item => ({
            x: new Date(item.date),
            y: item.value
        }));
        
        // Обновляем данные графика
        this.chart.data.datasets[datasetIndex].data = chartData;
        
        // Обновляем границы оси X если нужно
        if (type === 'historical' || this.state.currentView === type) {
            const allDates = [
                ...this.chart.data.datasets[0].data,
                ...this.chart.data.datasets[1].data
            ].map(item => item.x).filter(date => date);
            
            if (allDates.length > 0) {
                const minDate = new Date(Math.min(...allDates));
                const maxDate = new Date(Math.max(...allDates));
                
                // Добавляем небольшой отступ
                minDate.setDate(minDate.getDate() - 2);
                maxDate.setDate(maxDate.getDate() + 2);
                
                this.chart.options.scales.x.min = minDate;
                this.chart.options.scales.x.max = maxDate;
            }
        }
        
        // Обновляем границу оси Y
        const allValues = [
            ...this.chart.data.datasets[0].data,
            ...this.chart.data.datasets[1].data
        ].map(item => item.y).filter(value => !isNaN(value));
        
        if (allValues.length > 0) {
            const minValue = Math.min(...allValues);
            const maxValue = Math.max(...allValues);
            const padding = (maxValue - minValue) * 0.1; // 10% отступ
            
            this.chart.options.scales.y.min = minValue - padding;
            this.chart.options.scales.y.max = maxValue + padding;
        }
        
        this.chart.update('none');
    }

    /**
     * Переключение вида графика
     */
    toggleChartView(view) {
        this.state.currentView = view;
        
        // Обновляем активные кнопки
        [this.elements.toggleHistorical, this.elements.toggleForecast, this.elements.toggleBoth]
            .forEach(btn => btn.classList.remove('active'));
        
        switch (view) {
            case 'historical':
                this.elements.toggleHistorical.classList.add('active');
                break;
            case 'forecast':
                this.elements.toggleForecast.classList.add('active');
                break;
            case 'both':
                this.elements.toggleBoth.classList.add('active');
                break;
        }
        
        // Обновляем видимость наборов данных
        if (this.chart) {
            this.chart.data.datasets[0].hidden = (view === 'forecast');
            this.chart.data.datasets[1].hidden = (view === 'historical');
            this.chart.update();
        }
    }

    /**
     * Сброс формы
     */
    resetForm() {
        if (this.state.isLoading) return;
        
        // Сброс данных
        this.state.historicalData = [];
        this.state.forecastData = [];
        
        // Сброс графика
        if (this.chart) {
            this.chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.chart.update();
        }
        
        // Сброс к виду "оба графика"
        this.toggleChartView('both');
        
        // Сброс дат
        this.setupDates();
        
        // Сброс выбора валютной пары
        this.elements.currencyPairSelect.value = 'USD_RUB';
        this.state.currencyPair = 'USD_RUB';
        
        // Сброс периода прогноза
        this.elements.forecastDaysSelect.value = '14';
        this.state.forecastDays = 14;
        
        // Обновление состояния кнопок
        this.updateButtonStates();
        
        // Показ уведомления
        this.showSuccess('Форма сброшена');
        
        console.log('🔄 Форма сброшена');
    }

    /**
     * Показать индикатор загрузки
     */
    showLoading(message = 'Загрузка...') {
        this.state.isLoading = true;
        this.elements.loadingDetails.textContent = message;
        this.elements.loadingElement.style.display = 'block';
        this.updateButtonStates();
    }

    /**
     * Скрыть индикатор загрузки
     */
    hideLoading() {
        this.state.isLoading = false;
        this.elements.loadingElement.style.display = 'none';
        this.updateButtonStates();
    }

    /**
     * Показать уведомление об успехе
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Показать уведомление об ошибке
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#43A047' : type === 'error' ? '#E53935' : '#1E88E5'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
            font-family: inherit;
        `;
        
        // Анимация появления
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Автоматическое скрытие через 4 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 4000);
    }
}

/**
 * Инициализация приложения при загрузке страницы
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = new CurrencyForecastApp();
    app.init().catch(error => {
        console.error('Критическая ошибка:', error);
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 20px;
            ">
                <h1 style="margin-bottom: 20px;">⚠️ Ошибка загрузки</h1>
                <p style="margin-bottom: 30px; max-width: 500px;">
                    Не удалось загрузить приложение. Пожалуйста, проверьте консоль браузера для получения дополнительной информации.
                </p>
                <button onclick="location.reload()" style="
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    Перезагрузить страницу
                </button>
            </div>
        `;
    });
});

// Экспорт для отладки
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyForecastApp;
}