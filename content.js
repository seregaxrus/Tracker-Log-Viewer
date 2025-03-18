let pluginEnabled = true; // По умолчанию плагин включён
let isPageProcessed = false; // Флаг, чтобы избежать повторной обработки
let isInitialized = false; // Флаг для предотвращения двойной инициализации

// Функция для форматирования даты с учетом часового пояса
function formatDate(isoDate) {
  const date = new Date(isoDate);
  
  // Получаем часовой пояс пользователя
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Форматируем дату с учетом локального часового пояса
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const formattedDate = formatter.format(date);
  
  // Добавляем информацию о часовом поясе
  const timeZoneOffset = date.getTimezoneOffset();
  const timeZoneHours = Math.abs(Math.floor(timeZoneOffset / 60));
  const timeZoneMinutes = Math.abs(timeZoneOffset % 60);
  const timeZoneString = `UTC${timeZoneOffset <= 0 ? '+' : '-'}${String(timeZoneHours).padStart(2, '0')}:${String(timeZoneMinutes).padStart(2, '0')}`;
  
  // Преобразуем формат "DD.MM.YYYY, HH:mm:ss" в наш формат
  const [datePart, timePart] = formattedDate.split(', ');
  const [day, month, year] = datePart.split('.');
  
  return `Время: ${timePart} (${timeZoneString}), Дата: ${day}-${month}-${year}`;
}

// Функция для создания блока с логом
function createLogBlock(log) {
  // Добавляем отладочную информацию о структуре лога
  console.log('Структура лога:', {
    startTime: log.startTime, 
    endTime: log.endTime,
    formattedDate: formatDate(log.startTime)
  });
  
  const block = document.createElement("div");
  block.className = "log-block";

  // Определяем, является ли статус ошибочным
  const isError = log.response.statusCode >= 400;
  
  // Пытаемся распарсить тело ответа, если оно есть
  let responseBody = '';
  try {
    if (log.response.body) {
      const parsedBody = JSON.parse(log.response.body);
      responseBody = JSON.stringify(parsedBody, null, 2);
    }
  } catch (e) {
    responseBody = log.response.body;
  }

  // Верхняя часть блока (основная информация)
  const header = document.createElement("div");
  header.className = `log-header ${isError ? 'log-header_error' : ''}`;
  header.innerHTML = `
    <span><strong>${formatDate(log.startTime)}</strong></span>
    <span><strong>Статус:</strong> <span class="${isError ? 'error-status' : 'success-status'}">${log.response.statusCode}</span></span>
    <span><strong>Метод:</strong> ${log.request.method}</span>
    ${log.duration ? `<span><strong>Длительность:</strong> ${log.duration}ms</span>` : ''}
  `;

  // Детали блока (скрыты по умолчанию)
  const details = document.createElement("div");
  details.className = "log-details";
  details.innerHTML = `
    <h4>Запрос</h4>
    <p><strong>URL:</strong> ${log.request.endpoint}</p>
    <p><strong>Заголовки:</strong></p>
    <pre>${JSON.stringify(log.request.headers, null, 2)}</pre>
    ${log.request.body ? `
    <p><strong>Тело запроса:</strong></p>
    <pre>${log.request.body}</pre>
    ` : ''}

    <h4>Ответ</h4>
    <p><strong>Заголовки ответа:</strong></p>
    <pre>${JSON.stringify(log.response.headers, null, 2)}</pre>
    ${responseBody ? `
    <p><strong>Тело ответа:</strong></p>
    <pre class="${isError ? 'error-response' : ''}">${responseBody}</pre>
    ` : ''}
  `;
  details.style.display = "none"; // Скрываем детали по умолчанию

  // Обработчик клика для раскрытия/закрытия блока
  header.addEventListener("click", () => {
    if (details.style.display === "none") {
      details.style.display = "block";
    } else {
      details.style.display = "none";
    }
  });

  // Собираем блок
  block.appendChild(header);
  block.appendChild(details);
  return block;
}

// Функция для создания панели управления логами
function createControlPanel(logs) {
  const panel = document.createElement("div");
  panel.className = "log-control-panel";
  
  // Получаем текущие параметры из URL
  const urlParams = new URLSearchParams(window.location.search);
  const currentLimit = urlParams.get('limit') || '100';
  const currentFrom = urlParams.get('from') || '';
  const currentTo = urlParams.get('to') || '';
  
  // Функция для форматирования даты в формат для input type="datetime-local" с учетом часового пояса
  const formatDateForInput = (date) => {
    // Преобразуем дату с учетом локального часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Формат YYYY-MM-DDThh:mm для input type="datetime-local"
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // Форматируем даты для отображения в инпутах
  let fromDateValue = '';
  let toDateValue = '';
  
  if (currentFrom) {
    const fromDate = new Date(currentFrom);
    fromDateValue = formatDateForInput(fromDate);
    console.log('Форматирование даты "с":', {
      исходная: currentFrom,
      форматированная: fromDateValue,
      объектДаты: fromDate
    });
  }
  
  if (currentTo) {
    const toDate = new Date(currentTo);
    toDateValue = formatDateForInput(toDate);
    console.log('Форматирование даты "по":', {
      исходная: currentTo,
      форматированная: toDateValue,
      объектДаты: toDate
    });
  }
  
  // Создаем базовый URL для запросов (без параметров)
  const baseUrl = window.location.href.split('?')[0];
  
  // Функция для обновления URL и перезагрузки страницы
  function updateUrlAndReload(params) {
    const newUrl = `${baseUrl}?${params.toString()}`;
    window.location.href = newUrl;
  }
  
  // Создаем элементы управления
  panel.innerHTML = `
    <div class="control-group">
      <label for="sort-order">Сортировка:</label>
      <select id="sort-order" class="control-input">
        <option value="desc" selected>Сначала новые</option>
        <option value="asc">Сначала старые</option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="date-from">С даты:</label>
      <input type="datetime-local" id="date-from" class="control-input" value="${fromDateValue}">
    </div>
    
    <div class="control-group">
      <label for="date-to">По дату:</label>
      <input type="datetime-local" id="date-to" class="control-input" value="${toDateValue}">
    </div>
    
    <div class="control-group">
      <label for="limit-input">Лимит:</label>
      <input type="number" id="limit-input" class="control-input" min="1" max="1000" value="${currentLimit}">
    </div>
    
    <button id="apply-filters" class="control-button">Применить</button>
    <button id="reset-filters" class="control-button">Сбросить</button>
    <button id="toggle-all-logs" class="control-button">Развернуть все</button>
  `;
  
  // Добавляем обработчики событий после добавления панели в DOM
  setTimeout(() => {
    // Кнопка применения фильтров
    const applyButton = document.getElementById('apply-filters');
    if (applyButton) {
      applyButton.addEventListener('click', () => {
        const params = new URLSearchParams();
        
        // Получаем значения из элементов управления
        const limit = document.getElementById('limit-input').value;
        const fromDate = document.getElementById('date-from').value;
        const toDate = document.getElementById('date-to').value;
        const sortOrder = document.getElementById('sort-order').value;
        
        // Добавляем параметры в URL
        if (limit) params.set('limit', limit);
        
        if (fromDate) {
          // Преобразуем локальную дату в ISO формат с учетом часового пояса
          const fromDateObj = new Date(fromDate);
          // Записываем время с учетом локального часового пояса в UTC
          params.set('from', fromDateObj.toISOString());
          
          console.log('Отправка даты "с":', {
            исходнаяДата: fromDate,
            объектДаты: fromDateObj,
            ISO: fromDateObj.toISOString(),
            локальноеВремя: formatDate(fromDateObj)
          });
        }
        
        if (toDate) {
          // Преобразуем локальную дату в ISO формат с учетом часового пояса
          const toDateObj = new Date(toDate);
          // Записываем время с учетом локального часового пояса в UTC
          params.set('to', toDateObj.toISOString());
          
          console.log('Отправка даты "по":', {
            исходнаяДата: toDate,
            объектДаты: toDateObj,
            ISO: toDateObj.toISOString(),
            локальноеВремя: formatDate(toDateObj)
          });
        }
        
        // Обновляем URL и перезагружаем страницу
        updateUrlAndReload(params);
      });
    }
    
    // Кнопка сброса фильтров
    const resetButton = document.getElementById('reset-filters');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        // Сбрасываем все параметры кроме limit
        const params = new URLSearchParams();
        params.set('limit', '100'); // Устанавливаем дефолтный лимит
        updateUrlAndReload(params);
      });
    }
    
    // Кнопка разворачивания/сворачивания всех логов
    const toggleButton = document.getElementById('toggle-all-logs');
    if (toggleButton) {
      let allExpanded = false;
      
      toggleButton.addEventListener('click', () => {
        const logDetails = document.querySelectorAll('.log-details');
        
        logDetails.forEach(detail => {
          detail.style.display = allExpanded ? 'none' : 'block';
        });
        
        allExpanded = !allExpanded;
        toggleButton.textContent = allExpanded ? 'Свернуть все' : 'Развернуть все';
      });
    }
    
    // Сортировка логов на клиентской стороне
    const sortSelect = document.getElementById('sort-order');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const container = document.getElementById('log-container');
        const logBlocks = Array.from(container.querySelectorAll('.log-block'));
        
        // Удаляем все блоки
        logBlocks.forEach(block => block.remove());
        
        // Сортируем логи
        if (sortSelect.value === 'asc') {
          // От старых к новым
          logs.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        } else {
          // От новых к старым
          logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        }
        
        // Добавляем отсортированные блоки обратно
        logs.forEach(log => {
          try {
            container.appendChild(createLogBlock(log));
          } catch (error) {
            console.error('Ошибка при создании блока лога:', error);
          }
        });
      });
    }
  }, 0);
  
  return panel;
}

// Функция для определения типа страницы
function getPageType() {
  const url = window.location.href;
  
  // Проверяем, является ли страница страницей логов триггера (приоритет выше)
  if (url.includes('/triggers/') && url.includes('/webhooks/log')) {
    // Дополнительная проверка содержимого страницы для страницы логов
    try {
      if (document.body && document.body.innerText.trim().startsWith('[')) {
        try {
          const content = document.body.innerText.trim();
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].request && parsed[0].response) {
            console.log('Определен тип страницы как logs по содержимому');
            return 'logs';
          }
        } catch (e) {
          // Если не удалось распарсить, продолжаем проверку по URL
        }
      }
    } catch (e) {
      console.error('Ошибка при проверке содержимого страницы:', e);
    }
    
    console.log('Определен тип страницы как logs по URL');
    return 'logs';
  }
  
  // Проверяем, является ли страница страницей истории задачи
  if (url.includes('/history')) {
    console.log('Определен тип страницы как history');
    return 'history';
  }
  
  // Проверяем, является ли страница страницей задачи (чтобы отследить вкладку истории)
  if (url.match(/^https:\/\/st\.yandex-team\.ru\/[A-Z]+-\d+$/)) {
    console.log('Определен тип страницы как task');
    return 'task';
  }
  
  // Проверяем, является ли страница страницей триггеров или общим списком
  if (url.includes('/automation/triggers') || url.includes('/automation/all')) {
    return 'triggers';
  }
  
  return 'unknown';
}

// Функция для создания иконки логов
function createLogIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A1.5 1.5 0 013.5 1h9A1.5 1.5 0 0114 2.5v11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11zM3.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-9z"/>
    <path d="M4.5 5h7a.5.5 0 010 1h-7a.5.5 0 010-1zm0 2.5h7a.5.5 0 010 1h-7a.5.5 0 010-1zm0 2.5h7a.5.5 0 010 1h-7a.5.5 0 010-1z"/>
  </svg>`;
}

// Функция для добавления ссылки на логи к триггеру
function addLogLinkToTrigger(triggerElement) {
  console.log('Обработка элемента таблицы:', triggerElement);
  
  // Проверяем, является ли строка триггером
  let triggerId = null;
  let isExecuteOrderMode = false;
  
  // Проверяем, в каком режиме отображения мы находимся
  const executeOrderRadio = document.querySelector('input[value="execute-order"]');
  if (executeOrderRadio && executeOrderRadio.checked) {
    isExecuteOrderMode = true;
    console.log('Обнаружен режим "Порядок срабатывания"');
  }
  
  // Получаем ID триггера
  // Сначала из атрибута data-id строки
  triggerId = triggerElement.getAttribute('data-id') || 
             triggerElement.getAttribute('data-trigger-id');
  
  // Если не нашли ID в атрибутах строки, ищем в дочерних элементах
  if (!triggerId) {
    const idElement = triggerElement.querySelector('[data-id]');
    if (idElement) {
      triggerId = idElement.getAttribute('data-id');
    }
  }
  
  // Если не нашли ID через атрибуты, пробуем найти через ссылку
  if (!triggerId) {
    const link = triggerElement.querySelector('a[href*="/automation/"]');
    if (link && link.href.includes('/triggers/')) {
      triggerId = link.href.match(/\/triggers\/(\d+)/)?.[1];
    }
  }
  
  // Если не нашли ID, значит это не триггер
  if (!triggerId) {
    console.log('Не удалось найти ID триггера, пропускаем');
    return;
  }
  
  console.log('Найден ID триггера:', triggerId);
  
  // Проверяем, нет ли уже ссылки на логи
  if (triggerElement.querySelector('.trigger-log-link')) {
    console.log('Ссылка на логи уже существует');
    return;
  }
  
  const queueKey = window.location.pathname.split('/')[3];
  
  // Создаем ссылку на логи
  const logLink = document.createElement('a');
  logLink.className = 'trigger-log-link';
  logLink.href = `https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?limit=100`;
  logLink.target = '_blank';
  logLink.innerHTML = `${createLogIcon()} Логи`;
  
  // Добавляем обработчик клика для предотвращения всплытия события
  logLink.addEventListener('click', (e) => {
    e.preventDefault(); // Предотвращаем стандартное поведение ссылки
    e.stopPropagation(); // Останавливаем всплытие события
    window.open(logLink.href, '_blank'); // Открываем ссылку в новой вкладке
  });
  
  // Добавляем стили для корректного отображения
  logLink.style.marginLeft = '8px';
  logLink.style.display = 'inline-flex';
  logLink.style.verticalAlign = 'middle';
  
  // Разные способы добавления ссылки в зависимости от режима
  if (isExecuteOrderMode) {
    // Для режима "порядок срабатывания"
    
    // Находим ячейку с названием триггера
    const nameCell = triggerElement.querySelector('.triggers-execute-order-list__list-cell_key_name');
    
    if (nameCell) {
      // Находим ссылку с названием триггера внутри ячейки
      const titleLink = nameCell.querySelector('.automation-title-cell');
      
      if (titleLink) {
        // Находим текст названия триггера
        const titleSpan = titleLink.querySelector('.automation-title-cell__name');
        
        if (titleSpan) {
          // Вставляем ссылку после текста названия
          titleSpan.insertAdjacentElement('afterend', logLink);
          console.log('Ссылка добавлена после названия в режиме "порядок срабатывания"');
          return;
        }
        
        // Если не нашли span с названием, добавляем в конец ссылки
        titleLink.appendChild(logLink);
        console.log('Ссылка добавлена в конец ссылки с названием в режиме "порядок срабатывания"');
        return;
      }
      
      // Если не нашли ссылку с названием, добавляем в конец ячейки
      nameCell.appendChild(logLink);
      console.log('Ссылка добавлена в конец ячейки с названием в режиме "порядок срабатывания"');
      return;
    }
    
    // Если не нашли ячейку с названием, ищем контент-обертку
    const contentWrapper = triggerElement.querySelector('.triggers-execute-order-list__content-wrapper');
    if (contentWrapper) {
      // Находим первую ячейку после номера (обычно это название)
      const cells = contentWrapper.querySelectorAll('.triggers-execute-order-list__list-cell');
      if (cells.length > 1) {
        const secondCell = cells[1]; // Вторая ячейка (после номера)
        
        // Находим ссылку или span внутри ячейки
        const titleElement = secondCell.querySelector('a') || secondCell.querySelector('span');
        if (titleElement) {
          titleElement.appendChild(logLink);
          console.log('Ссылка добавлена в элемент с названием в режиме "порядок срабатывания"');
          return;
        }
        
        // Если не нашли элемент с названием, добавляем в саму ячейку
        secondCell.appendChild(logLink);
        console.log('Ссылка добавлена во вторую ячейку в режиме "порядок срабатывания"');
        return;
      }
      
      // Если не нашли ячейки, добавляем в саму обертку
      contentWrapper.appendChild(logLink);
      console.log('Ссылка добавлена в контент-обертку в режиме "порядок срабатывания"');
      return;
    }
    
    // Если ничего не нашли, добавляем в саму строку
    triggerElement.appendChild(logLink);
    console.log('Ссылка добавлена в строку в режиме "порядок срабатывания"');
  } else {
    // Для режима "произвольный порядок"
    const titleCell = triggerElement.querySelector('.automation-title-cell');
    
    if (titleCell) {
      const titleSpan = titleCell.querySelector('.automation-title-cell__name');
      if (titleSpan) {
        titleSpan.insertAdjacentElement('afterend', logLink);
        console.log('Ссылка добавлена после названия в режиме "произвольный порядок"');
      } else {
        titleCell.appendChild(logLink);
        console.log('Ссылка добавлена в ячейку с названием в режиме "произвольный порядок"');
      }
    } else {
      // Если не нашли ячейку с названием, добавляем в первую ячейку
      const firstCell = triggerElement.querySelector('td:first-child');
      if (firstCell) {
        firstCell.appendChild(logLink);
        console.log('Ссылка добавлена в первую ячейку в режиме "произвольный порядок"');
      } else {
        triggerElement.appendChild(logLink);
        console.log('Ссылка добавлена в строку в режиме "произвольный порядок"');
      }
    }
  }
}

// Функция для обработки страницы триггеров
function processTriggersPage() {
  console.log('Начало обработки страницы триггеров');
  
  // Проверяем, в каком режиме отображения мы находимся
  const executeOrderRadio = document.querySelector('input[value="execute-order"]');
  const isExecuteOrderMode = executeOrderRadio && executeOrderRadio.checked;
  
  console.log('Режим отображения:', isExecuteOrderMode ? 'Порядок срабатывания' : 'Произвольный порядок');
  
  // Получаем все строки таблицы в зависимости от режима
  let rows;
  if (isExecuteOrderMode) {
    // Для режима "порядок срабатывания"
    rows = document.querySelectorAll('.triggers-execute-order-list__row');
  } else {
    // Для режима "произвольный порядок"
    rows = document.querySelectorAll('.gt-table__row');
  }
  
  console.log('Найдено строк в таблице:', rows.length);
  
  if (!pluginEnabled) {
    console.log('Плагин отключен, удаляем существующие ссылки');
    const logLinks = document.querySelectorAll('.trigger-log-link');
    logLinks.forEach(link => link.remove());
    
    // Сбрасываем атрибуты обработки
    rows.forEach(row => {
      row.removeAttribute('data-processed');
    });
    
    return;
  }
  
  // Если не нашли строки, попробуем найти все возможные варианты
  if (rows.length === 0) {
    rows = document.querySelectorAll('.gt-table__row, .triggers-execute-order-list__row');
    console.log('Повторный поиск строк в таблице:', rows.length);
  }
  
  // Обрабатываем каждую строку
  rows.forEach(row => {
    // Проверяем, не обработана ли уже эта строка
    if (!row.hasAttribute('data-processed') || row.getAttribute('data-processed') !== 'true') {
      addLogLinkToTrigger(row);
      // Помечаем строку как обработанную
      row.setAttribute('data-processed', 'true');
    }
  });
}

// Функция для обработки страницы логов
function processLogsPage() {
  console.log('Обработка страницы логов');
  
  try {
    // Проверяем, что body существует
    if (!document.body) {
      console.error('document.body не существует');
      return;
    }
    
    // Если страница уже обработана, ничего не делаем
    if (document.getElementById('log-container')) {
      console.log('Страница логов уже обработана');
      return;
    }
    
    // Получаем параметры URL для определения контекста (задача или общий лог)
    const urlParams = getUrlParams();
    const { triggerId, queueKey, issueId } = urlParams;
    
    console.log('Параметры URL:', { triggerId, queueKey, issueId });
    
    // Проверяем, содержит ли страница ошибку 500
    const bodyText = document.body.innerText.trim();
    if (bodyText.includes('500') && (bodyText.includes('Internal Server Error') || bodyText.includes('Внутренняя ошибка сервера'))) {
      console.log('Обнаружена ошибка 500, создаем интерфейс выбора дат');
      createErrorPageWithDateSelector();
      return;
    }
    
    // Сохраняем оригинальный JSON, если еще не сохранен
    if (!sessionStorage.getItem('originalJson')) {
      const originalJson = document.body.innerText;
      sessionStorage.setItem('originalJson', originalJson);
      document.body.setAttribute('data-original-json', originalJson);
      console.log('Исходный JSON сохранен');
    }
    
    // Парсим JSON и создаем форматированное представление
    const jsonData = document.body.innerText.trim();
    let logs;
    
    try {
      logs = JSON.parse(jsonData);
      
      // Проверяем, является ли ответ объектом с ошибкой 403
      if (!Array.isArray(logs) && logs.statusCode === 403) {
        console.log('Обнаружена ошибка 403, создаем страницу с сообщением о доступе');
        createAccessDeniedPage(logs);
        return;
      }
      
      // Проверяем, что это действительно массив логов
      if (!Array.isArray(logs)) {
        throw new Error('Данные не являются массивом');
      }
      
      // Проверяем, что в массиве есть хотя бы один элемент
      if (logs.length === 0) {
        // Создаем контейнер для пустого списка логов
    const container = document.createElement("div");
    container.id = "log-container";

        // Создаем панель управления
        const controlPanel = createControlPanel([]);
        
        // Создаем навигационную панель (если нужно)
        let navPanel = null;
        if (triggerId && queueKey) {
          navPanel = createNavigationPanel(triggerId, queueKey, issueId);
        }
        
        // Добавляем сообщение о пустом списке
        const emptyMessage = document.createElement("div");
        emptyMessage.innerHTML = `
          <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
            <h2>Логи отсутствуют</h2>
            <p>В истории нет записей о HTTP-запросах для этого триггера.</p>
          </div>
        `;
        
        // Заменяем содержимое страницы
        document.body.innerHTML = "";
        if (navPanel) document.body.appendChild(navPanel);
        document.body.appendChild(controlPanel);
        document.body.appendChild(container);
        container.appendChild(emptyMessage);
        
        console.log('Страница логов успешно обработана (пустой список)');
        return;
      }
      
      // Проверяем структуру первого лога
      const firstLog = logs[0];
      if (!firstLog.request || !firstLog.response) {
        throw new Error('Неверная структура данных логов');
      }
      
      // По умолчанию сортируем от новых к старым
      logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      
      // Добавляем отладочную информацию о форматировании дат
      if (logs.length > 0) {
        console.log('Пример форматирования даты:', {
          оригинальнаяДата: logs[0].startTime,
          форматированнаяДата: formatDate(logs[0].startTime),
          часовойПояс: Intl.DateTimeFormat().resolvedOptions().timeZone,
          смещениеUTC: new Date().getTimezoneOffset()
        });
      }
      
    } catch (parseError) {
      console.error("Ошибка при парсинге JSON:", parseError);
      
      // Проверяем, может быть это ошибка 500
      if (bodyText.includes('500') || bodyText.includes('Internal Server Error') || bodyText.includes('Внутренняя ошибка сервера')) {
        console.log('Обнаружена ошибка 500 при парсинге, создаем интерфейс выбора дат');
        createErrorPageWithDateSelector();
        return;
      }
      
      // Показываем сообщение об ошибке на странице
      document.body.innerHTML = `
        <div style="color: red; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Ошибка при парсинге JSON</h2>
          <p>${parseError.message}</p>
          <pre>${jsonData.substring(0, 500)}${jsonData.length > 500 ? '...' : ''}</pre>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Перезагрузить страницу</button>
        </div>
      `;
      return;
    }
    
    // Создаем навигационную панель (если применимо)
    let navPanel = null;
    if (triggerId && queueKey) {
      navPanel = createNavigationPanel(triggerId, queueKey, issueId);
    }
    
    // Создаем панель управления
    const controlPanel = createControlPanel(logs);
    
    // Создаем контейнер для логов
    const container = document.createElement("div");
    container.id = "log-container";

    // Добавляем блоки с логами
    logs.forEach(log => {
      try {
      container.appendChild(createLogBlock(log));
      } catch (logError) {
        console.error("Ошибка при создании блока лога:", logError, log);
        // Добавляем блок с ошибкой вместо лога
        const errorBlock = document.createElement("div");
        errorBlock.className = "log-block";
        errorBlock.innerHTML = `
          <div class="log-header log-header_error">
            <span><strong>Ошибка при обработке лога</strong></span>
            <span>${logError.message}</span>
          </div>
        `;
        container.appendChild(errorBlock);
      }
    });

    // Заменяем содержимое страницы
    document.body.innerHTML = "";
    if (navPanel) document.body.appendChild(navPanel);
    document.body.appendChild(controlPanel);
    document.body.appendChild(container);

    console.log('Страница логов успешно обработана');
  } catch (e) {
    console.error("Ошибка при обработке страницы логов:", e);
    
    // Показываем сообщение об ошибке на странице, если body существует
    if (document.body) {
      document.body.innerHTML = `
        <div style="color: red; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Ошибка при обработке страницы логов</h2>
          <p>${e.message}</p>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Перезагрузить страницу</button>
        </div>
      `;
    }
  }
}

// Функция для создания навигационной панели
function createNavigationPanel(triggerId, queueKey, issueId) {
  const panel = document.createElement("div");
  panel.className = "log-navigation-panel";
  
  // Определяем тип страницы (общая история или история в задаче)
  const isIssueSpecific = !!issueId;
  
  // Получаем текущее время для отображения в панели
  const currentTime = new Date();
  const formattedCurrentTime = formatDate(currentTime);
  
  // Создаем содержимое панели в зависимости от типа страницы
  if (isIssueSpecific) {
    // Если мы на странице истории триггера в конкретной задаче
    panel.innerHTML = `
      <div class="nav-title">
        <span>История триггера (${triggerId}) в задаче ${issueId}</span>
      </div>
      <div class="nav-time">
        <span>${formattedCurrentTime}</span>
      </div>
      <div class="nav-actions">
        <a href="https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?limit=100" 
           class="nav-button" target="_blank">
          ${createAllLogsIcon()} Общая история триггера
        </a>
        <a href="https://st.yandex-team.ru/${issueId}" 
           class="nav-button" target="_blank">
          Вернуться к задаче
        </a>
        <a href="https://st.yandex-team.ru/admin/queue/${queueKey}/automation/triggers/${triggerId}" 
           class="nav-button nav-button-settings" target="_blank">
          ${createSettingsIcon()} Настройки триггера
        </a>
      </div>
    `;
  } else {
    // Если мы на странице общей истории триггера
    panel.innerHTML = `
      <div class="nav-title">
        <span>Общая история триггера (${triggerId})</span>
      </div>
      <div class="nav-time">
        <span>${formattedCurrentTime}</span>
      </div>
      <div class="nav-actions">
        <a href="https://st.yandex-team.ru/admin/queue/${queueKey}/automation/triggers" 
           class="nav-button" target="_blank">
          Список триггеров
        </a>
        <a href="https://st.yandex-team.ru/admin/queue/${queueKey}/automation/triggers/${triggerId}" 
           class="nav-button nav-button-settings" target="_blank">
          ${createSettingsIcon()} Настройки триггера
        </a>
      </div>
    `;
  }
  
  // Добавляем стили для панели
  const style = document.createElement('style');
  style.textContent = `
    .log-navigation-panel {
      background-color: #f8f9fa;
      border-bottom: 1px solid #ddd;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      font-family: Arial, sans-serif;
      flex-wrap: wrap;
    }
    
    .nav-title {
      font-weight: bold;
      font-size: 16px;
      flex: 1;
    }
    
    .nav-time {
      font-size: 12px;
      color: #666;
      margin: 5px 0;
      flex-basis: 100%;
    }
    
    .nav-actions {
      display: flex;
      gap: 10px;
    }
    
    .nav-button {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      background-color: #027bf3;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      gap: 6px;
    }
    
    .nav-button:hover {
      background-color: #0263c3;
    }
    
    .nav-button svg {
      width: 16px;
      height: 16px;
    }

    .nav-button-settings {
      background-color: #6c757d;
    }

    .nav-button-settings:hover {
      background-color: #5a6268;
    }
    
    @media (max-width: 768px) {
      .log-navigation-panel {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .nav-actions {
        margin-top: 10px;
        flex-wrap: wrap;
      }
    }
  `;
  document.head.appendChild(style);
  
  return panel;
}

// Функция для создания страницы с ошибкой 500 и селектором дат
function createErrorPageWithDateSelector() {
  console.log('Создание страницы с ошибкой 500 и селектором дат');
  
  // Получаем текущий URL и параметры
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.split('?')[0];
  const urlParams = new URLSearchParams(window.location.search);
  
  // Получаем текущие параметры из URL
  const currentLimit = urlParams.get('limit') || '100';
  const currentFrom = urlParams.get('from') || '';
  const currentTo = urlParams.get('to') || '';
  
  // Создаем контейнер для страницы с ошибкой
  const container = document.createElement('div');
  container.id = 'error-container';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  
  // Создаем заголовок и описание
  const header = document.createElement('div');
  header.innerHTML = `
    <h1 style="color: #d32f2f; margin-bottom: 10px;">Ошибка 500: Слишком большой объем данных</h1>
    <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
      Сервер не может обработать запрос из-за слишком большого объема данных в истории срабатывания триггера.
      Для решения этой проблемы, пожалуйста, укажите диапазон дат для ограничения объема запрашиваемых данных.
    </p>
    <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
      Текущее время: ${formatDate(new Date())}
    </p>
  `;
  
  // Создаем форму для выбора дат
  const form = document.createElement('div');
  form.className = 'log-control-panel';
  form.style.marginBottom = '30px';
  
  // Получаем текущую дату и дату 7 дней назад для значений по умолчанию
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  
  // Функция для форматирования даты в формат для input type="datetime-local" с учетом часового пояса
  const formatDateForInput = (date) => {
    // Преобразуем дату с учетом локального часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Формат YYYY-MM-DDThh:mm для input type="datetime-local"
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // Значения по умолчанию с учетом часового пояса
  const defaultFrom = currentFrom ? formatDateForInput(new Date(currentFrom)) : formatDateForInput(weekAgo);
  const defaultTo = currentTo ? formatDateForInput(new Date(currentTo)) : formatDateForInput(today);
  
  form.innerHTML = `
    <div class="control-group">
      <label for="date-from">С даты:</label>
      <input type="datetime-local" id="date-from" class="control-input" value="${defaultFrom}">
    </div>
    
    <div class="control-group">
      <label for="date-to">По дату:</label>
      <input type="datetime-local" id="date-to" class="control-input" value="${defaultTo}">
    </div>
    
    <div class="control-group">
      <label for="limit-input">Лимит:</label>
      <input type="number" id="limit-input" class="control-input" min="1" max="1000" value="${currentLimit}">
    </div>
    
    <button id="apply-filters" class="control-button">Применить</button>
  `;
  
  // Создаем блок с дополнительной информацией
  const infoBlock = document.createElement('div');
  infoBlock.style.backgroundColor = '#f5f5f5';
  infoBlock.style.padding = '15px';
  infoBlock.style.borderRadius = '5px';
  infoBlock.style.marginTop = '20px';
  infoBlock.innerHTML = `
    <h3 style="margin-top: 0; color: #333;">Почему возникла эта ошибка?</h3>
    <p>Некоторые триггеры имеют очень большую историю срабатываний, и сервер не может вернуть все данные сразу.</p>
    <p>Решение: укажите небольшой временной диапазон (например, несколько дней) и ограничьте количество записей.</p>
    <p>Рекомендуемые настройки:</p>
    <ul>
      <li>Диапазон дат: не более 7 дней</li>
      <li>Лимит: не более 100 записей</li>
    </ul>
  `;
  
  // Собираем страницу
  container.appendChild(header);
  container.appendChild(form);
  container.appendChild(infoBlock);
  
  // Заменяем содержимое страницы
  document.body.innerHTML = '';
  document.body.appendChild(container);
  
  // Добавляем обработчик для кнопки применения фильтров
  setTimeout(() => {
    const applyButton = document.getElementById('apply-filters');
    if (applyButton) {
      applyButton.addEventListener('click', () => {
        const params = new URLSearchParams();
        
        // Получаем значения из элементов управления
        const limit = document.getElementById('limit-input').value;
        const fromDate = document.getElementById('date-from').value;
        const toDate = document.getElementById('date-to').value;
        
        // Добавляем параметры в URL
        if (limit) params.set('limit', limit);
        
        if (fromDate) {
          // Преобразуем локальную дату в ISO формат с учетом часового пояса
          const fromDateObj = new Date(fromDate);
          // Записываем время с учетом локального часового пояса в UTC
          params.set('from', fromDateObj.toISOString());
          
          console.log('Отправка даты "с":', {
            исходнаяДата: fromDate,
            объектДаты: fromDateObj,
            ISO: fromDateObj.toISOString(),
            локальноеВремя: formatDate(fromDateObj)
          });
        }
        
        if (toDate) {
          // Преобразуем локальную дату в ISO формат с учетом часового пояса
          const toDateObj = new Date(toDate);
          // Записываем время с учетом локального часового пояса в UTC
          params.set('to', toDateObj.toISOString());
          
          console.log('Отправка даты "по":', {
            исходнаяДата: toDate,
            объектДаты: toDateObj,
            ISO: toDateObj.toISOString(),
            локальноеВремя: formatDate(toDateObj)
          });
        }
        
        // Обновляем URL и перезагружаем страницу
        const newUrl = `${baseUrl}?${params.toString()}`;
        window.location.href = newUrl;
      });
    }
  }, 0);
  
  console.log('Страница с ошибкой 500 и селектором дат создана');
}

// Функция для инициализации наблюдателя за вкладками истории
function setupHistoryTabObserver() {
  console.log('Настройка наблюдателя за вкладками истории');
  
  // Отключаем старый observer, если он существует
  if (window._historyTabObserver) {
    window._historyTabObserver.disconnect();
    window._historyTabObserver = null;
    console.log('Отключен старый наблюдатель за вкладками истории');
  }
  
  // Функция для поиска и обработки вкладки истории
  function findAndProcessHistoryTab() {
    console.log('Поиск вкладки "История" в DOM...');
    
    // Ищем вкладки во всех возможных форматах
    const tabs = document.querySelectorAll('.g-tabs__item, .tabs-menu__item');
    console.log('Найдено вкладок:', tabs.length);
    
    // Для отладки выводим все найденные вкладки
    tabs.forEach((tab, index) => {
      const title = tab.textContent || '';
      console.log(`Вкладка ${index + 1}: "${title.trim()}"`);
    });
    
    // Флаг, чтобы отслеживать, нашли ли вкладку истории
    let historyTabFound = false;
    
    // Проверяем, есть ли среди них вкладка "История"
    tabs.forEach(tab => {
      const tabTitle = tab.querySelector('.g-tabs__item-title, .tabs-menu__item-text') || tab;
      const tabText = tabTitle.textContent || '';
      
      if (tabText.includes('История') || tabText.includes('History')) {
        console.log('Найдена вкладка "История":', tabText);
        historyTabFound = true;
        
        // Проверяем, не добавлен ли уже обработчик
        if (!tab._historyTabObserverAdded) {
          // Добавляем обработчик клика на вкладку
          tab.addEventListener('click', () => {
            console.log('Клик по вкладке "История"');
            
            // Запускаем обработку с небольшой задержкой, чтобы DOM успел обновиться
            setTimeout(() => {
              console.log('Запуск обработки истории после клика по вкладке');
              
              // Сбрасываем флаг обработки, чтобы история обрабатывалась заново при каждом клике
              document.body.removeAttribute('data-history-processed');
              processHistoryPage();
            }, 500);
          });
          
          // Отмечаем, что обработчик добавлен
          tab._historyTabObserverAdded = true;
          console.log('Добавлен обработчик клика для вкладки "История"');
          
          // Проверяем, активна ли вкладка сейчас
          if (tab.classList.contains('g-tabs__item_active') || 
              tab.classList.contains('tabs-menu__item_active') || 
              tab.getAttribute('aria-selected') === 'true') {
            console.log('Вкладка "История" активна, запускаем обработку');
            setTimeout(() => {
              processHistoryPage();
            }, 500);
          }
        }
      }
    });
    
    // Если вкладка истории не найдена, ищем ее во всех возможных ссылках
    if (!historyTabFound) {
      console.log('Вкладка "История" не найдена среди стандартных вкладок, ищем в ссылках...');
      
      // Ищем все ссылки на странице
      const links = document.querySelectorAll('a[href*="/history"]');
      console.log('Найдено ссылок на историю:', links.length);
      
      links.forEach((link, index) => {
        console.log(`Ссылка ${index + 1}: ${link.textContent.trim()} (${link.href})`);
        
        // Если ссылка ведет на историю текущей задачи
        if (link.href.includes(window.location.pathname + '/history')) {
          console.log('Найдена ссылка на историю задачи');
          
          // Проверяем, не добавлен ли уже обработчик
          if (!link._historyLinkObserverAdded) {
            // Добавляем обработчик клика на ссылку
            link.addEventListener('click', (e) => {
              console.log('Клик по ссылке на историю');
              
              // Если ссылка активна и обработчик клика сработал,
              // запускаем обработку с задержкой для обновления DOM
              setTimeout(() => {
                console.log('Запуск обработки истории после клика по ссылке');
                document.body.removeAttribute('data-history-processed');
                processHistoryPage();
              }, 500);
            });
            
            // Отмечаем, что обработчик добавлен
            link._historyLinkObserverAdded = true;
            console.log('Добавлен обработчик клика для ссылки на историю');
          }
        }
      });
    }
  }
  
  // Запускаем первичный поиск вкладок
  findAndProcessHistoryTab();
  
  // Настраиваем наблюдатель за изменениями в DOM
  const observer = new MutationObserver((mutations) => {
    let relevantChangesDetected = false;
    
    mutations.forEach(mutation => {
      // Проверяем добавленные узлы
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const hasTabsOrLinksAdded = Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== 1) return false; // Пропускаем не-элементы
          
          // Проверяем, является ли узел вкладкой или содержит вкладки
          const hasTabs = node.classList?.contains('g-tabs__item') || 
                          node.classList?.contains('tabs-menu__item') || 
                          node.querySelector?.('.g-tabs__item, .tabs-menu__item');
          
          // Проверяем, является ли узел ссылкой на историю или содержит такие ссылки
          const hasHistoryLinks = (node.tagName === 'A' && node.href?.includes('/history')) || 
                                  node.querySelector?.('a[href*="/history"]');
          
          return hasTabs || hasHistoryLinks;
        });
        
        if (hasTabsOrLinksAdded) {
          relevantChangesDetected = true;
        }
      }
      
      // Проверяем изменения атрибутов у вкладок
      if (mutation.type === 'attributes' && 
          (mutation.target.classList?.contains('g-tabs__item') || 
           mutation.target.classList?.contains('tabs-menu__item') ||
           (mutation.target.tagName === 'A' && mutation.target.href?.includes('/history')))) {
        relevantChangesDetected = true;
      }
    });
    
    // Если обнаружены изменения в вкладках, запускаем поиск и обработку вкладки истории
    if (relevantChangesDetected) {
      console.log('Обнаружены изменения в вкладках, перепроверяем');
      findAndProcessHistoryTab();
    }
  });
  
  // Начинаем наблюдение за всем body, так как вкладки могут быть добавлены динамически
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'href']
  });
  
  window._historyTabObserver = observer;
  console.log('Наблюдатель за вкладками истории настроен');
  
  // Также проверяем URL, возможно мы уже на странице истории
  if (window.location.href.includes('/history')) {
    console.log('Страница истории уже открыта, запускаем обработку');
    setTimeout(() => {
      processHistoryPage();
    }, 500);
  }
}

// Функция для обработки страницы истории задачи
function processHistoryPage() {
  console.log('Обработка страницы истории задачи');
  
  // Если страница уже обработана, ничего не делаем
  if (document.body.hasAttribute('data-history-processed')) {
    console.log('Страница истории уже обработана');
    return;
  }
  
  // Добавляем отладочную информацию
  console.log('DOM для истории:', document.body.innerHTML.substring(0, 500) + '...');
  
  // Получаем ключ очереди и ID задачи из URL
  const urlParts = window.location.pathname.split('/');
  const issueKey = urlParts[1]; // Например, CLOUDLAUNCH-305
  if (!issueKey || !issueKey.includes('-')) {
    console.log('Не удалось определить ключ задачи', issueKey);
    return;
  }
  
  const queueKey = issueKey.split('-')[0]; // Например, CLOUDLAUNCH
  const issueNumber = issueKey.split('-')[1]; // Например, 305
  console.log('Определен ключ очереди:', queueKey, 'и номер задачи:', issueNumber);
  
  // Регулярные выражения для поиска ID триггера
  const triggerIdRegex = /\((\d+)\)/g;
  
  // Ищем все варианты блоков, где могут быть упоминания триггеров
  const historyItems = document.querySelectorAll('.history__value, .ep-history-diff-block__item, .ep-history-diff-block__title + div');
  console.log('Найдено блоков истории для проверки:', historyItems.length);
  
  let processedCount = 0;
  
  // Проверяем напрямую весь HTML на странице
  const htmlContent = document.body.innerHTML;
  if (htmlContent.includes('отправлен HTTP-запрос') || htmlContent.includes('Сработали триггеры')) {
    console.log('Найдены текстовые упоминания триггеров в HTML страницы');
  } else {
    console.log('Не найдено упоминаний триггеров в HTML страницы');
  }
  
  // Обрабатываем каждый блок, где могут быть упоминания триггеров
  historyItems.forEach((item, index) => {
    // Получаем текст элемента для проверки
    const textContent = item.textContent || '';
    console.log(`Блок истории ${index + 1}: ${textContent.substring(0, 100)}...`);
    
    // Проверяем, есть ли в тексте упоминания триггеров
    if (textContent.includes('отправлен HTTP-запрос') || textContent.includes('Сработали триггеры')) {
      console.log(`Найдено упоминание триггера в блоке ${index + 1}`);
      
      // Сохраняем оригинальный HTML
      const originalHTML = item.innerHTML;
      
      // Найдем все ID триггеров в тексте
      let newHTML = originalHTML;
      let match;
      
      // Сбрасываем lastIndex для регулярного выражения
      triggerIdRegex.lastIndex = 0;
      
      // Находим все ID триггеров в HTML
      while ((match = triggerIdRegex.exec(originalHTML)) !== null) {
        const triggerId = match[1];
        const fullMatch = match[0]; // (123456)
        
        console.log(`Найден ID триггера: ${triggerId} в блоке ${index + 1}`);
        
        // Формируем URL для логов триггера (общий лог)
        const generalLogUrl = `https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?limit=100`;
        
        // Формируем URL для логов триггера в конкретной задаче
        const issueSpecificLogUrl = `https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?pretty&IssueId=${issueKey}`;
        
        // Создаем замену - делаем ID триггера кликабельным (ведет на логи в текущей задаче)
        // и добавляем иконку для перехода к общей истории триггера
        const replacement = `(<a href="${issueSpecificLogUrl}" target="_blank" class="trigger-id-link" data-trigger-id="${triggerId}" title="Просмотреть историю триггера в этой задаче">${triggerId}</a> <a href="${generalLogUrl}" target="_blank" class="trigger-log-link-inline-all" data-trigger-id="${triggerId}" title="Просмотреть общую историю триггера"><span class="trigger-log-icon-all">${createAllLogsIcon()}</span></a>)`;
        
        // Заменяем ID в HTML
        newHTML = newHTML.replace(fullMatch, replacement);
      }
      
      // Если были изменения, обновляем HTML
      if (newHTML !== originalHTML) {
        item.innerHTML = newHTML;
        processedCount++;
        
        // Добавляем обработчики клика для ссылок
        const triggerLinks = item.querySelectorAll('.trigger-log-link-inline, .trigger-log-link-inline-all');
        triggerLinks.forEach(link => {
          link.addEventListener('click', (e) => {
            e.stopPropagation(); // Предотвращаем всплытие события
          });
        });
      }
    }
  });
  
  // Проверяем, нашли ли мы хоть одно упоминание триггера
  if (processedCount === 0) {
    console.log('Упоминаний триггеров не найдено. Проверяем новый формат...');
    
    // Ищем все возможные контейнеры, где может быть текст
    const allTextContainers = document.querySelectorAll('div, span, p');
    console.log(`Найдено текстовых контейнеров для дополнительной проверки: ${allTextContainers.length}`);
    
    allTextContainers.forEach((container, index) => {
      const textContent = container.textContent || '';
      
      if (textContent.includes('отправлен HTTP-запрос') || textContent.includes('Сработали триггеры')) {
        console.log(`Найдено упоминание триггера в контейнере ${index}`);
        console.log(`Содержимое: ${textContent.substring(0, 100)}...`);
        
        // Сохраняем оригинальный HTML
        const originalHTML = container.innerHTML;
        
        // Найдем все ID триггеров в тексте
        let newHTML = originalHTML;
        let match;
        
        // Сбрасываем lastIndex для регулярного выражения
        triggerIdRegex.lastIndex = 0;
        
        // Находим все ID триггеров в HTML
        while ((match = triggerIdRegex.exec(originalHTML)) !== null) {
          const triggerId = match[1];
          const fullMatch = match[0]; // (123456)
          
          console.log(`Найден ID триггера: ${triggerId} в контейнере ${index}`);
          
          // Формируем URL для логов триггера (общий лог)
          const generalLogUrl = `https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?limit=100`;
          
          // Формируем URL для логов триггера в конкретной задаче
          const issueSpecificLogUrl = `https://st-api.yandex-team.ru/v2/queues/${queueKey}/triggers/${triggerId}/webhooks/log?pretty&IssueId=${issueKey}`;
          
          // Создаем замену - делаем ID триггера кликабельным (ведет на логи в текущей задаче)
          // и добавляем иконку для перехода к общей истории триггера
          const replacement = `(<a href="${issueSpecificLogUrl}" target="_blank" class="trigger-id-link" data-trigger-id="${triggerId}" title="Просмотреть историю триггера в этой задаче">${triggerId}</a> <a href="${generalLogUrl}" target="_blank" class="trigger-log-link-inline-all" data-trigger-id="${triggerId}" title="Просмотреть общую историю триггера"><span class="trigger-log-icon-all">${createAllLogsIcon()}</span></a>)`;
          
          // Заменяем ID в HTML
          newHTML = newHTML.replace(fullMatch, replacement);
        }
        
        // Если были изменения, обновляем HTML
        if (newHTML !== originalHTML) {
          container.innerHTML = newHTML;
          processedCount++;
          
          // Добавляем обработчики клика для ссылок
          const triggerLinks = container.querySelectorAll('.trigger-log-link-inline, .trigger-log-link-inline-all');
          triggerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
              e.stopPropagation(); // Предотвращаем всплытие события
            });
          });
        }
      }
    });
  }
  
  // Если нашли и обработали триггеры, добавляем стили
  if (processedCount > 0) {
    // Добавляем стили для ссылок на триггеры в истории
    const style = document.createElement('style');
    style.textContent = `
      .trigger-id {
        font-weight: bold;
      }
      .trigger-id-link {
        font-weight: bold;
        color: #027bf3;
        text-decoration: none;
      }
      .trigger-id-link:hover {
        text-decoration: underline;
      }
      .trigger-log-link-inline,
      .trigger-log-link-inline-all {
        color: #027bf3;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        margin: 0 3px;
      }
      .trigger-log-icon-issue svg {
        width: 12px;
        height: 12px;
        color: #027bf3;
      }
      .trigger-log-icon-all svg {
        width: 12px;
        height: 12px;
        color: #4caf50;
      }
      .trigger-log-link-inline:hover,
      .trigger-log-link-inline-all:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
    
    console.log(`Обработано ${processedCount} упоминаний триггеров`);
  } else {
    console.log('Упоминаний триггеров не найдено. Добавление ссылок не выполнено.');
  }
  
  // Помечаем страницу как обработанную
  document.body.setAttribute('data-history-processed', 'true');
  console.log('Обработка страницы истории завершена');
}

// Функция для настройки MutationObserver для страницы триггеров
function setupMutationObserver() {
  console.log('Настройка MutationObserver для страницы триггеров');
  
  // Отключаем старый observer, если он существует
  if (window._triggerObserver) {
    window._triggerObserver.disconnect();
    console.log('Отключен старый observer');
  }
  
  // Функция для обработки изменений в DOM
  function handleDOMChanges() {
    console.log('Обработка изменений DOM');
    
    // Сбрасываем флаги обработки для всех строк
    document.querySelectorAll('.gt-table__row, .triggers-execute-order-list__row').forEach(row => {
      row.removeAttribute('data-processed');
    });
    
    // Обрабатываем страницу заново с задержкой
    setTimeout(() => {
      if (pluginEnabled) {
        processTriggersPage();
      }
    }, 300);
  }
  
  // Создаем новый observer
  const observer = new MutationObserver((mutations) => {
    // Проверяем изменения в DOM
    let hasNewRows = false;
    let hasTabChange = false;
    let hasRadioChange = false;
    
    for (const mutation of mutations) {
      // Проверяем изменение URL (переключение вкладок)
      if (window.location.href !== window._lastUrl) {
        console.log('Обнаружено изменение URL:', window._lastUrl, '->', window.location.href);
        window._lastUrl = window.location.href;
        hasTabChange = true;
      }
      
      if (mutation.type === 'childList') {
        // Проверяем, добавились ли новые строки таблицы или изменилась структура DOM
        const addedNodes = Array.from(mutation.addedNodes);
        const hasTableChanges = addedNodes.some(node => 
          node.nodeType === 1 && (
            node.classList?.contains('gt-table__row') ||
            node.classList?.contains('triggers-execute-order-list__row') ||
            node.querySelector?.('.gt-table__row') ||
            node.querySelector?.('.triggers-execute-order-list__row') ||
            node.classList?.contains('triggers-execute-order-list') ||
            node.querySelector?.('.triggers-execute-order-list')
          )
        );
        
        if (hasTableChanges) {
          hasNewRows = true;
        }
        
        // Проверяем, изменились ли вкладки
        const hasTabsChanges = addedNodes.some(node => 
          node.nodeType === 1 && (
            node.classList?.contains('tabs-menu__item') ||
            node.querySelector?.('.tabs-menu__item')
          )
        );
        
        if (hasTabsChanges) {
          hasTabChange = true;
        }
      }
      
      // Проверяем изменение атрибутов радио-кнопок (переключение режима отображения)
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'class' && 
            (mutation.target.classList?.contains('g-radio-button__option') ||
             mutation.target.classList?.contains('g-radio-button__option_checked'))) {
          console.log('Обнаружено изменение класса радио-кнопки:', mutation.target);
          hasRadioChange = true;
        }
        
        if (mutation.attributeName === 'checked' || 
            mutation.attributeName === 'aria-checked') {
          console.log('Обнаружено изменение состояния радио-кнопки:', mutation.target);
          hasRadioChange = true;
        }
      }
    }
    
    // Если обнаружено переключение вкладок или режима отображения
    if (hasTabChange || hasRadioChange) {
      const eventType = hasTabChange ? 'переключение вкладок' : 'изменение режима отображения';
      console.log(`Обнаружено ${eventType}`);
      handleDOMChanges();
    }
    // Если обнаружены новые строки, но не переключение вкладок или режима
    else if (hasNewRows) {
      console.log('Обнаружены новые строки в таблице');
      handleDOMChanges();
    }
  });
  
  // Сохраняем текущий URL
  window._lastUrl = window.location.href;
  
  // Ищем корневой элемент для наблюдения
  const targetNode = document.querySelector('.page-list__content') || document.body;
  
  // Настраиваем параметры наблюдения
  const config = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'checked', 'aria-checked', 'value']
  };
  
  // Начинаем наблюдение
  observer.observe(targetNode, config);
  console.log('MutationObserver для страницы триггеров настроен');
  
  // Добавляем прямые обработчики для радио-кнопок
  function setupRadioListeners() {
    // Находим все радио-кнопки
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    console.log('Найдено радио-кнопок:', radioButtons.length);
    
    radioButtons.forEach(radio => {
      if (!radio._hasChangeListener) {
        radio.addEventListener('change', () => {
          console.log('Обнаружено изменение радио-кнопки через событие change:', radio.value);
          handleDOMChanges();
        });
        radio._hasChangeListener = true;
      }
    });
    
    // Находим контейнер радио-кнопок
    const radioContainer = document.querySelector('[role="radiogroup"]');
    if (radioContainer && !radioContainer._hasClickListener) {
      radioContainer.addEventListener('click', (e) => {
        console.log('Клик по контейнеру радио-кнопок');
        // Добавляем небольшую задержку для обработки после изменения DOM
        setTimeout(handleDOMChanges, 300);
      });
      radioContainer._hasClickListener = true;
    }
  }
  
  // Устанавливаем обработчики сразу
  setupRadioListeners();
  
  // И периодически проверяем, не появились ли новые радио-кнопки
  if (!window._radioCheckInterval) {
    window._radioCheckInterval = setInterval(setupRadioListeners, 2000);
  }
  
  // Сохраняем observer для возможности отключения в будущем
  window._triggerObserver = observer;
}

// Основная функция для обработки страницы
function processPage() {
  console.log('Начало обработки страницы');
  console.log('URL:', window.location.href);
  console.log('Плагин включен:', pluginEnabled);
  
  const pageType = getPageType();
  console.log('Тип страницы:', pageType);
  
  if (!pluginEnabled) {
    console.log('Плагин отключен');
    
    // Даже если плагин отключен, нам нужно удалить ссылки на логи
    if (pageType === 'triggers') {
      processTriggersPage();
    }
    
    return;
  }

  if (pageType === 'triggers') {
    // Обработка страницы триггеров
    processTriggersPage();
    // Устанавливаем observer для отслеживания изменений
    setupMutationObserver();
  } else if (pageType === 'logs') {
    // Обработка страницы логов
    processLogsPage();
  } else if (pageType === 'history') {
    // Обработка страницы истории задачи
    processHistoryPage();
  } else if (pageType === 'task') {
    // Настраиваем наблюдатель за вкладками на странице задачи
    console.log('Настройка наблюдателя за вкладками на странице задачи');
    setupHistoryTabObserver();
  } else {
    console.log('Неизвестный тип страницы, пропускаем обработку');
    return;
  }
}

// Функция для восстановления исходного JSON
function restoreOriginalJson() {
  console.log('Восстановление исходного JSON');
  
  try {
    // Пробуем получить исходный JSON из sessionStorage
    const originalData = sessionStorage.getItem('originalJson');
    
    if (originalData) {
      // Проверяем, что body существует
      if (!document.body) {
        console.error('document.body не существует');
        return false;
      }
      
      // Очищаем текущее содержимое
      document.body.innerHTML = '';
      
      // Создаем текстовый узел с исходным JSON
      const textNode = document.createTextNode(originalData);
      document.body.appendChild(textNode);
      
      console.log('Исходный JSON восстановлен из sessionStorage');
      return true;
    } else {
      // Если в sessionStorage нет, пробуем из атрибута
      if (!document.body) {
        console.error('document.body не существует');
        return false;
      }
      
      const attrData = document.body.getAttribute('data-original-json');
      if (attrData) {
        document.body.innerHTML = '';
        const textNode = document.createTextNode(attrData);
        document.body.appendChild(textNode);
        console.log('Исходный JSON восстановлен из атрибута');
        return true;
      } else {
        console.error('Не найден исходный JSON');
        return false;
      }
    }
  } catch (e) {
    console.error("Ошибка при восстановлении JSON:", e);
    return false;
  }
}

// Инициализация при загрузке страницы
function initializePage() {
  // Предотвращаем двойную инициализацию
  if (isInitialized) {
    console.log('Страница уже инициализирована');
    return;
  }
  
  isInitialized = true;
  
  // Определяем тип страницы
  const pageType = getPageType();
  console.log('Инициализация страницы. Тип:', pageType);
  
  // Если это страница задачи, настраиваем наблюдатель за вкладками
  if (window.location.pathname.match(/^\/[A-Z]+-\d+$/)) {
    console.log('Обнаружена страница задачи, настраиваем наблюдатель за вкладками');
    setupHistoryTabObserver();
  }
  
  // Добавляем небольшую задержку для полной загрузки страницы
  setTimeout(() => {
    // Загружаем состояние плагина
chrome.storage.local.get("pluginEnabled", (data) => {
      if (chrome.runtime.lastError) {
        console.error('Ошибка при получении состояния плагина:', chrome.runtime.lastError);
        return;
      }
      
  pluginEnabled = data.pluginEnabled !== false; // По умолчанию плагин включён
      console.log('Загружено состояние плагина:', pluginEnabled);
      
      // Если это страница логов
      if (pageType === 'logs') {
        try {
          // Проверяем, что body существует
          if (!document.body) {
            console.error('document.body не существует');
            return;
          }
          
          // Если плагин выключен
          if (!pluginEnabled) {
            console.log('Плагин отключен, проверяем необходимость восстановления JSON');
            
            // Очищаем sessionStorage, чтобы гарантировать, что страница не будет форматироваться
            if (sessionStorage.getItem('originalJson')) {
              console.log('Найден сохраненный JSON, удаляем его');
              sessionStorage.removeItem('originalJson');
            }
            
            // Проверяем, была ли страница уже отформатирована
            if (document.getElementById('log-container')) {
              console.log('Страница уже отформатирована, перезагружаем страницу');
              window.location.reload();
              return;
            } else {
              console.log('Страница не форматирована, ничего не делаем');
            }
            return;
          }
          
          // Сохраняем оригинальный JSON только если он еще не сохранен
          if (!sessionStorage.getItem('originalJson')) {
            const originalJson = document.body.innerText;
            sessionStorage.setItem('originalJson', originalJson);
            document.body.setAttribute('data-original-json', originalJson);
            console.log('Исходный JSON сохранен при загрузке');
          } else {
            console.log('Исходный JSON уже был сохранен ранее');
          }
        } catch (e) {
          console.error('Ошибка при сохранении исходного JSON:', e);
        }
      }
      
      // Обрабатываем страницу
  processPage();
      
      // Добавляем обработчик для проверки изменений URL каждые 300 мс
      if (!window._urlChangeInterval) {
        window._lastPathname = window.location.pathname;
        window._urlChangeInterval = setInterval(() => {
          const currentPathname = window.location.pathname;
          const currentSearch = window.location.search;
          
          // Проверяем изменение пути или параметров запроса
          if (window._lastPathname !== currentPathname || window._lastSearch !== currentSearch) {
            console.log('Обнаружено изменение URL через интервал:', 
                        window._lastPathname + (window._lastSearch || ''), 
                        '->', 
                        currentPathname + currentSearch);
            
            window._lastPathname = currentPathname;
            window._lastSearch = currentSearch;
            
            // Сбрасываем флаги и переинициализируем страницу
            isInitialized = false;
            
            // Отключаем старый наблюдатель за вкладками, если он есть
            if (window._historyTabObserver) {
              window._historyTabObserver.disconnect();
              window._historyTabObserver = null;
              console.log('Отключен наблюдатель за вкладками истории');
            }
            
            initializePage();
          }
        }, 300);
        
        window._lastSearch = window.location.search;
        console.log('Добавлен интервал для отслеживания изменений URL');
      }
    });
  }, 100); // Уменьшаем задержку для более быстрой обработки
}

// Добавляем обработчик для более раннего запуска инициализации
document.addEventListener("DOMContentLoaded", () => {
  // Проверяем, является ли страница страницей логов
  if (window.location.href.includes('/triggers/') && window.location.href.includes('/webhooks/log')) {
    console.log('Обнаружена страница логов, запускаем раннюю инициализацию');
    
    // Запускаем инициализацию немедленно
    initializePage();
    
    // Настраиваем MutationObserver для отслеживания изменений в DOM
    const observer = new MutationObserver((mutations) => {
      // Если страница еще не обработана и body содержит JSON
      if (!document.getElementById('log-container') && 
          document.body && 
          document.body.innerText.trim().startsWith('[')) {
        console.log('Обнаружен JSON в body, запускаем обработку');
        
        // Отключаем observer, чтобы избежать повторных вызовов
        observer.disconnect();
        
        // Запускаем обработку страницы
        processLogsPage();
      }
    });
    
    // Начинаем наблюдение за изменениями в body
    observer.observe(document, { childList: true, subtree: true });
  }
});

// Запускаем инициализацию страницы после загрузки DOM и при полной загрузке страницы
// Используем оба обработчика для надежности, но с флагом для предотвращения двойной инициализации
document.addEventListener("DOMContentLoaded", initializePage);
window.addEventListener("load", initializePage);

// Слушаем сообщения об изменении состояния плагина
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Получено сообщение:', message);
  
  try {
  if (message.pluginEnabled !== undefined) {
      const newState = message.pluginEnabled;
      console.log('Новое состояние плагина:', newState);
      
      // Сохраняем новое состояние
      pluginEnabled = newState;
      
      // Обрабатываем изменение состояния
      const pageType = getPageType();
      console.log('Тип страницы при изменении состояния:', pageType);
      
      if (newState) {
        // Включение плагина
        console.log('Включение плагина');
        
        if (pageType === 'logs') {
          // Для страницы логов обрабатываем страницу
          processLogsPage();
        } else if (pageType === 'triggers') {
          // Для страницы триггеров обрабатываем страницу
          processTriggersPage();
        }
        
        // Отправляем ответ, что сообщение обработано
        sendResponse({ success: true, newState: newState, pageType: pageType });
    } else {
        // Выключение плагина
        console.log('Выключение плагина');
        
        if (pageType === 'triggers') {
          // Для страницы триггеров удаляем ссылки на логи
          processTriggersPage(); // Функция сама удалит ссылки, если плагин выключен
          
          // Отправляем ответ, что сообщение обработано
          sendResponse({ success: true, newState: newState, pageType: pageType });
        } else if (pageType === 'logs') {
          // Для страницы логов очищаем sessionStorage и перезагружаем страницу
          console.log('Очищаем sessionStorage и перезагружаем страницу');
          sessionStorage.removeItem('originalJson');
          
          // Отправляем ответ перед перезагрузкой
          sendResponse({ success: true, newState: newState, pageType: pageType });
          
          // Перезагружаем страницу после отправки ответа
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          // Отправляем ответ, что сообщение обработано
          sendResponse({ success: true, newState: newState, pageType: pageType });
        }
      }
    } else {
      // Если сообщение не содержит pluginEnabled
      console.warn('Получено неизвестное сообщение:', message);
      sendResponse({ success: false, error: 'Неизвестное сообщение' });
    }
  } catch (error) {
    // Обрабатываем любые ошибки
    console.error('Ошибка при обработке сообщения:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  // Возвращаем true, чтобы указать, что будем отправлять ответ асинхронно
  return true;
});

// Функция для извлечения параметров из URL
function getUrlParams() {
  const url = window.location.href;
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);
  
  // Извлекаем ID триггера из пути URL
  let triggerId = null;
  const triggerMatch = url.match(/\/triggers\/(\d+)\/webhooks\/log/);
  if (triggerMatch && triggerMatch[1]) {
    triggerId = triggerMatch[1];
  }
  
  // Извлекаем ключ очереди из пути URL
  let queueKey = null;
  const queueMatch = url.match(/\/queues\/([A-Z0-9]+)\//);
  if (queueMatch && queueMatch[1]) {
    queueKey = queueMatch[1];
  }
  
  // Извлекаем ID задачи из параметра
  const issueId = params.get('IssueId');
  
  return {
    triggerId,
    queueKey,
    issueId,
    params
  };
}

// Функция для создания иконки всех логов
function createAllLogsIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2H2a2 2 0 0 1-2-2V2zm5 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2v5a2 2 0 0 1-2 2H5zm6-8V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2V6a2 2 0 0 1 2-2h5z"/>
  </svg>`;
}

// Функция для создания страницы с ошибкой доступа 403
function createAccessDeniedPage(errorData) {
  console.log('Создание страницы с ошибкой 403', errorData);
  
  // Получаем информацию из объекта ошибки
  const statusCode = errorData.statusCode || 403;
  const errorMessages = errorData.errorMessages || ['У вас недостаточно прав доступа.'];
  const queue = errorData.errorsData?.queue || { key: 'неизвестно', display: 'неизвестно' };
  const owner = errorData.errorsData?.owner || { 
    display: 'администратору', 
    email: '', 
    login: '' 
  };
  
  // Создаем контейнер для страницы с ошибкой
  const container = document.createElement('div');
  container.id = 'error-container';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  
  // Создаем заголовок и описание
  const header = document.createElement('div');
  header.innerHTML = `
    <h1 style="color: #d32f2f; margin-bottom: 10px;">Ошибка ${statusCode}: Доступ запрещен</h1>
    <div style="background-color: #fff8e1; border-left: 4px solid #ffa000; padding: 15px; margin-bottom: 20px;">
      <p style="font-size: 16px; line-height: 1.5; margin: 0;">
        ${errorMessages.join('<br>')}
      </p>
    </div>
  `;
  
  // Создаем блок с информацией об очереди
  const queueInfo = document.createElement('div');
  queueInfo.style.backgroundColor = '#f5f5f5';
  queueInfo.style.padding = '15px';
  queueInfo.style.marginBottom = '20px';
  queueInfo.style.borderRadius = '4px';
  queueInfo.innerHTML = `
    <h3 style="margin-top: 0; color: #333;">Информация об очереди</h3>
    <p><strong>Название:</strong> ${queue.display}</p>
    <p><strong>Ключ:</strong> ${queue.key}</p>
  `;
  
  // Создаем блок с информацией о владельце, если она доступна
  let ownerInfo = '';
  if (owner && owner.email) {
    const ownerEmail = owner.email;
    const subject = encodeURIComponent(`Запрос доступа к логам очереди ${queue.key}`);
    const body = encodeURIComponent(`Здравствуйте!\n\nПрошу предоставить мне доступ к логам триггеров очереди ${queue.key} (${queue.display}).\n\nС уважением,\n`);
    
    ownerInfo = `
      <div style="background-color: #e8f5e9; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #333;">Как получить доступ</h3>
        <p>Обратитесь к владельцу очереди: <strong>${owner.display}</strong> (${owner.login})</p>
        <a href="mailto:${ownerEmail}?subject=${subject}&body=${body}" style="display: inline-block; background-color: #4caf50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
          📧 Отправить запрос владельцу
        </a>
      </div>
    `;
  }
  
  // Создаем кнопку для возврата назад
  const backButton = document.createElement('div');
  backButton.innerHTML = `
    <button onclick="window.history.back()" style="background-color: #2196f3; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 14px;">
      ← Вернуться назад
    </button>
  `;
  
  // Собираем все элементы вместе
  container.appendChild(header);
  container.appendChild(queueInfo);
  if (ownerInfo) {
    container.insertAdjacentHTML('beforeend', ownerInfo);
  }
  container.appendChild(backButton);
  
  // Заменяем содержимое страницы
  document.body.innerHTML = '';
  document.body.appendChild(container);
  
  console.log('Страница с ошибкой 403 создана');
}

// Функция для создания иконки настроек
function createSettingsIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.319.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
  </svg>`;
}