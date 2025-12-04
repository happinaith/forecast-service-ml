class ForecastApp {
    constructor() {
        this.chart = null;
        this.currentTicker = null;
        this.forecastData = null;
        this.symbols = [];
        this.filteredSymbols = [];

        this.initElements();
        this.initEvents();
        this.loadSymbols();
    }

    initElements() {
        // Основные элементы
        this.tickerSearch = document.getElementById('tickerSearch');
        this.tickerList = document.getElementById('tickerList');
        this.horizonRange = document.getElementById('horizonRange');
        this.horizonInput = document.getElementById('horizonInput');
        this.horizonValue = document.getElementById('horizonValue');
        this.forecastButton = document.getElementById('forecastButton');
        this.chartTitle = document.getElementById('chartTitle');
        this.chartSubtitle = document.getElementById('chartSubtitle');
        this.noDataMessage = document.getElementById('noDataMessage');
        this.statsContainer = document.getElementById('statsContainer');
        this.forecastDetails = document.getElementById('forecastDetails');
        this.detailsGrid = document.getElementById('detailsGrid');
        this.errorContainer = document.getElementById('errorContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        // Элементы управления графиком
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.downloadBtn = document.getElementById('downloadBtn');

        // Canvas для графика
        this.chartCanvas = document.getElementById('priceChart');
    }

    initEvents() {
        // Поиск тикеров
        this.tickerSearch.addEventListener('input', () => this.filterSymbols());

        // Управление горизонтом прогноза
        this.horizonRange.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.horizonValue.textContent = value;
            this.horizonInput.value = value;
        });

        this.horizonInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            if (value < 3) value = 3;
            if (value > 30) value = 30;
            this.horizonRange.value = value;
            this.horizonValue.textContent = value;
        });

        // Кнопка прогноза
        this.forecastButton.addEventListener('click', () => this.runForecast());

        // Управление графиком
        this.zoomInBtn.addEventListener('click', () => this.zoomChart(1.2));
        this.zoomOutBtn.addEventListener('click', () => this.zoomChart(0.8));
        this.downloadBtn.addEventListener('click', () => this.downloadData());

        // Обработка Enter в поиске
        this.tickerSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.filteredSymbols.length > 0) {
                this.selectTicker(this.filteredSymbols[0].value);
            }
        });

        // Начальный выбор тикера
        this.tickerList.addEventListener('click', (e) => {
            const tickerOption = e.target.closest('.ticker-option');
            if (tickerOption) {
                const ticker = tickerOption.dataset.ticker;
                this.selectTicker(ticker);
            }
        });
    }

    async loadSymbols() {
        try {
            const response = await fetch('/api/symbols');
            if (!response.ok) throw new Error('Не удалось загрузить список символов');
            
            const data = await response.json();
            this.symbols = data.symbols || [];
            this.renderSymbols();
        } catch (error) {
            this.showError('Ошибка загрузки списка тикеров. Проверьте подключение к серверу.');
            console.error('Error loading symbols:', error);
        }
    }

    renderSymbols() {
        this.tickerList.innerHTML = '';
        
        const symbolsToRender = this.filteredSymbols.length > 0 ? this.filteredSymbols : this.symbols;
        
        symbolsToRender.forEach(symbol => {
            const option = document.createElement('div');
            option.className = 'ticker-option';
            option.dataset.ticker = symbol.value;
            
            if (this.currentTicker === symbol.value) {
                option.classList.add('selected');
            }
            
            const typeClass = this.getTickerType(symbol.value);
            
            option.innerHTML = `
                <div class="ticker-info">
                    <div class="ticker-symbol">${symbol.value}</div>
                    <div class="ticker-name">${symbol.label}</div>
                </div>
                <div class="ticker-type ${typeClass}">${this.getTypeLabel(typeClass)}</div>
            `;
            
            this.tickerList.appendChild(option);
        });
    }

    filterSymbols() {
        const searchTerm = this.tickerSearch.value.toLowerCase();
        
        if (!searchTerm) {
            this.filteredSymbols = [];
            this.renderSymbols();
            return;
        }
        
        this.filteredSymbols = this.symbols.filter(symbol => {
            return symbol.value.toLowerCase().includes(searchTerm) ||
                   symbol.label.toLowerCase().includes(searchTerm);
        });
        
        this.renderSymbols();
    }

    selectTicker(ticker) {
        this.currentTicker = ticker;
        this.renderSymbols();
        
        const symbol = this.symbols.find(s => s.value === ticker);
        if (symbol) {
            this.updateChartTitle(symbol.label);
        }
        
        // Прокрутить к выбранному элементу
        const selectedOption = this.tickerList.querySelector('.ticker-option.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    getTickerType(ticker) {
        if (ticker.includes('=X')) return 'currency';
        if (ticker === 'GC=F' || ticker === 'BZ=F') return 'commodity';
        return 'stock';
    }

    getTypeLabel(typeClass) {
        const labels = {
            'stock': 'Акция',
            'currency': 'Валюта',
            'commodity': 'Товар'
        };
        return labels[typeClass] || 'Другое';
    }

    updateChartTitle(title) {
        this.chartTitle.textContent = title;
        this.chartSubtitle.textContent = 'Исторические данные и прогноз';
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.add('active');
            this.forecastButton.innerHTML = '<div class="spinner"></div><span>Обработка...</span>';
            this.forecastButton.disabled = true;
        } else {
            this.loadingOverlay.classList.remove('active');
            this.forecastButton.innerHTML = '<span>🚀 Запустить прогноз</span>';
            this.forecastButton.disabled = false;
        }
    }

    showError(message) {
        this.errorContainer.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <div>${message}</div>
            </div>
        `;
        
        // Автоматическое скрытие через 5 секунд
        setTimeout(() => {
            this.errorContainer.innerHTML = '';
        }, 5000);
    }

    clearError() {
        this.errorContainer.innerHTML = '';
    }

    async runForecast() {
        this.clearError();
        
        if (!this.currentTicker) {
            this.showError('Выберите тикер для прогноза');
            return;
        }
        
        const horizon = parseInt(this.horizonInput.value);
        if (isNaN(horizon) || horizon < 3 || horizon > 30) {
            this.showError('Горизонт прогноза должен быть от 3 до 30 дней');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/forecast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticker: this.currentTicker,
                    horizon: horizon
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Ошибка сервера');
            }
            
            this.forecastData = await response.json();
            this.renderChart();
            this.renderStats();
            this.renderDetails();
            
            // Показать блок с деталями
            this.forecastDetails.style.display = 'block';
            
            // Скрыть сообщение о отсутствии данных
            this.noDataMessage.style.display = 'none';
            
        } catch (error) {
            console.error('Forecast error:', error);
            this.showError(`Ошибка прогноза: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    renderChart() {
        const ctx = this.chartCanvas.getContext('2d');
        
        // Уничтожить старый график если есть
        if (this.chart) {
            this.chart.destroy();
        }
        
        const history = this.forecastData.history;
        const forecast = this.forecastData.forecast;
        
        // Объединяем даты и цены
        const allDates = [...history.dates, ...forecast.dates];
        const allPrices = [...history.prices, ...forecast.prices];
        
        // Определяем границу между историей и прогнозом
        const forecastStartIndex = history.dates.length;
        
        // Создаем метки для легенды
        const historyData = allPrices.map((price, index) => 
            index < forecastStartIndex ? price : null
        );
        
        const forecastData = allPrices.map((price, index) => 
            index >= forecastStartIndex ? price : null
        );
        
        // Определяем цвета в зависимости от тренда
        const lastHistoryPrice = history.prices[history.prices.length - 1];
        const lastForecastPrice = forecast.prices[forecast.prices.length - 1];
        const forecastColor = lastForecastPrice >= lastHistoryPrice ? '#10b981' : '#ef4444';
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allDates,
                datasets: [
                    {
                        label: 'История',
                        data: historyData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Прогноз',
                        data: forecastData,
                        borderColor: forecastColor,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 3,
                        pointBackgroundColor: forecastColor,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.parsed.y.toFixed(2);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: (value) => {
                                return typeof value === 'number' ? value.toFixed(2) : value;
                            }
                        }
                    }
                }
            }
        });
    }

    renderStats() {
        if (!this.forecastData) return;
        
        const history = this.forecastData.history;
        const forecast = this.forecastData.forecast;
        
        const lastHistoryPrice = history.prices[history.prices.length - 1];
        const firstForecastPrice = forecast.prices[0];
        const lastForecastPrice = forecast.prices[forecast.prices.length - 1];
        
        // Рассчитываем статистику
        const historyPrices = history.prices;
        const forecastPrices = forecast.prices;
        
        const historyAvg = historyPrices.reduce((a, b) => a + b, 0) / historyPrices.length;
        const forecastAvg = forecastPrices.reduce((a, b) => a + b, 0) / forecastPrices.length;
        
        const historyVolatility = this.calculateVolatility(historyPrices);
        const forecastVolatility = this.calculateVolatility(forecastPrices);
        
        const totalChange = ((lastForecastPrice - lastHistoryPrice) / lastHistoryPrice) * 100;
        const dailyChange = totalChange / forecast.prices.length;
        
        const stats = [
            {
                title: 'Текущая цена',
                value: lastHistoryPrice.toFixed(2),
                change: null,
                icon: '💰'
            },
            {
                title: 'Прогноз на конец периода',
                value: lastForecastPrice.toFixed(2),
                change: totalChange.toFixed(2) + '%',
                changeType: totalChange >= 0 ? 'positive' : 'negative',
                icon: '📈'
            },
            {
                title: 'Среднедневное изменение',
                value: dailyChange.toFixed(2) + '%',
                change: null,
                icon: '📅'
            },
            {
                title: 'Волатильность прогноза',
                value: forecastVolatility.toFixed(2),
                change: null,
                icon: '⚡'
            }
        ];
        
        this.statsContainer.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-title">${stat.title}</div>
                    <div class="stat-icon">${stat.icon}</div>
                </div>
                <div class="stat-value">${stat.value}</div>
                ${stat.change ? `
                    <div class="stat-change ${stat.changeType}">
                        ${stat.changeType === 'positive' ? '↗' : '↘'} ${stat.change}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance) * 100; // В процентах
    }

    renderDetails() {
        if (!this.forecastData) return;
        
        const history = this.forecastData.history;
        const forecast = this.forecastData.forecast;
        
        const details = [
            { label: 'Тикер', value: this.forecastData.ticker },
            { label: 'Исторических точек', value: history.prices.length },
            { label: 'Прогнозных дней', value: forecast.prices.length },
            { label: 'Начало прогноза', value: forecast.dates[0] },
            { label: 'Конец прогноза', value: forecast.dates[forecast.dates.length - 1] },
            { label: 'Минимальный прогноз', value: Math.min(...forecast.prices).toFixed(2) },
            { label: 'Максимальный прогноз', value: Math.max(...forecast.prices).toFixed(2) }
        ];
        
        this.detailsGrid.innerHTML = details.map(detail => `
            <div class="detail-item">
                <div class="detail-label">${detail.label}</div>
                <div class="detail-value">${detail.value}</div>
            </div>
        `).join('');
    }

    zoomChart(factor) {
        if (!this.chart) return;
        
        const options = this.chart.options;
        
        if (options.scales.x.min !== undefined) {
            // Если уже есть zoom, изменим его
            const range = (options.scales.x.max - options.scales.x.min);
            const center = (options.scales.x.max + options.scales.x.min) / 2;
            const newRange = range / factor;
            
            options.scales.x.min = center - newRange / 2;
            options.scales.x.max = center + newRange / 2;
        } else {
            // Если нет zoom, создадим его
            const dataLength = this.chart.data.labels.length;
            const visiblePoints = Math.floor(dataLength / factor);
            const start = dataLength - visiblePoints;
            
            options.scales.x.min = Math.max(0, start);
            options.scales.x.max = dataLength - 1;
        }
        
        this.chart.update();
    }

    downloadData() {
        if (!this.forecastData) return;
        
        const history = this.forecastData.history;
        const forecast = this.forecastData.forecast;
        
        // Создаем CSV данные
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Дата,Тип,Цена\n";
        
        // Исторические данные
        history.dates.forEach((date, index) => {
            csvContent += `${date},История,${history.prices[index]}\n`;
        });
        
        // Прогнозные данные
        forecast.dates.forEach((date, index) => {
            csvContent += `${date},Прогноз,${forecast.prices[index]}\n`;
        });
        
        // Создаем ссылку для скачивания
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${this.forecastData.ticker}_forecast_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        // Автоматическое скачивание
        link.click();
        document.body.removeChild(link);
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ForecastApp();
});