// Элементы интерфейса
const toggleButton = document.getElementById("toggle-plugin");
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
let isButtonDisabled = false;

// Функция для обновления интерфейса в соответствии с состоянием
function updateUI(isEnabled) {
  // Обновляем текст кнопки
  toggleButton.textContent = isEnabled ? "Выключить" : "Включить";
  
  // Обновляем индикатор состояния
  statusIndicator.className = `status-indicator ${isEnabled ? 'status-on' : 'status-off'}`;
  statusText.textContent = isEnabled ? "Плагин включен" : "Плагин выключен";
}

// Функция для установки состояния кнопки (активна/неактивна)
function setButtonState(disabled) {
  isButtonDisabled = disabled;
  toggleButton.disabled = disabled;
  toggleButton.style.opacity = disabled ? "0.5" : "1";
  toggleButton.style.cursor = disabled ? "not-allowed" : "pointer";
}

// Функция для отправки сообщения в content script
function sendToggleMessage(newState) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error("Не найдена активная вкладка");
        resolve({ success: true, warning: "Нет активной вкладки" });
        return;
      }
      
      const activeTab = tabs[0];
      
      try {
        // Проверяем URL вкладки и выводим подробную информацию
        console.log("URL активной вкладки:", activeTab.url);
        
        if (!activeTab.url) {
          console.warn("URL вкладки отсутствует");
          resolve({ success: true, warning: "URL вкладки отсутствует" });
          return;
        }
        
        // Проверяем соответствие URL нашим паттернам
        const validUrlPatterns = [
          'st-api.yandex-team.ru/v2/queues/',
          'st.yandex-team.ru/admin/queue/'
        ];
        
        const isValidUrl = validUrlPatterns.some(pattern => activeTab.url.includes(pattern));
        
        if (!isValidUrl) {
          console.warn("URL не соответствует ожидаемым паттернам:", activeTab.url);
          resolve({ success: true, warning: "Страница не поддерживается плагином" });
          return;
        }
        
        // Отправляем сообщение с таймаутом
        const timeoutId = setTimeout(() => {
          console.warn("Таймаут при ожидании ответа от content script");
          resolve({ 
            success: true, 
            warning: "Таймаут ответа. Возможно, content script не загружен на этой странице." 
          });
        }, 1000);
        
        console.log("Отправка сообщения в content script:", { pluginEnabled: newState });
        
        chrome.tabs.sendMessage(
          activeTab.id, 
          { pluginEnabled: newState },
          (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              const errorMessage = chrome.runtime.lastError.message || "Неизвестная ошибка";
              console.warn("Ошибка при отправке сообщения:", {
                error: chrome.runtime.lastError,
                message: errorMessage,
                tabId: activeTab.id,
                url: activeTab.url
              });
              resolve({ success: true, warning: errorMessage });
            } else if (response && response.success) {
              console.log("Сообщение успешно обработано:", response);
              resolve(response);
            } else {
              console.warn("Неожиданный ответ от content script:", response);
              resolve({ 
                success: true, 
                warning: "Неожиданный ответ от content script" 
              });
            }
          }
        );
      } catch (error) {
        console.error("Критическая ошибка при отправке сообщения:", {
          error: error,
          message: error.message,
          stack: error.stack
        });
        resolve({ success: true, warning: `Ошибка: ${error.message}` });
      }
    });
  });
}

// Загружаем состояние плагина
chrome.storage.local.get("pluginEnabled", (data) => {
  const isEnabled = data.pluginEnabled !== false; // По умолчанию плагин включён
  updateUI(isEnabled);
});

// Обработчик клика по кнопке
toggleButton.addEventListener("click", async () => {
  if (isButtonDisabled) return;
  
  // Блокируем кнопку на время обработки
  setButtonState(true);
  
  try {
    // Получаем текущее состояние
    const data = await new Promise(resolve => {
      chrome.storage.local.get("pluginEnabled", resolve);
    });
    
    const currentState = data.pluginEnabled !== false;
    const newState = !currentState;
    
    console.log("Текущее состояние:", currentState);
    console.log("Новое состояние:", newState);
    
    // Сохраняем новое состояние
    await new Promise(resolve => {
      chrome.storage.local.set({ pluginEnabled: newState }, resolve);
    });
    
    // Отправляем сообщение в content script
    const response = await sendToggleMessage(newState);
    
    // Проверяем на предупреждения
    if (response.warning) {
      console.warn("Предупреждение:", response.warning);
      // Не показываем предупреждение пользователю, просто логируем
    }
    
    // Обновляем интерфейс
    updateUI(newState);
    
    console.log("Состояние успешно изменено");
  } catch (error) {
    console.error("Ошибка при изменении состояния:", error);
    // Не показываем ошибку пользователю, просто логируем
  } finally {
    // Разблокируем кнопку
    setButtonState(false);
  }
});

const triggers = document.querySelectorAll('.triggers-execute-order-list__row, .gt-table__row');