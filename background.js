/**
 * History Plus - Background Service Worker (Manifest V3)
 * Gerencia a abertura da barra lateral ao clicar no ícone da extensão.
 */

// Configura o Side Panel para abrir automaticamente com o clique no ícone da ação
async function configureSidePanelBehavior() {
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.warn('Aviso ao configurar openPanelOnActionClick:', error);
    }
  }
}

// Configuração ao instalar ou atualizar a extensão
chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
});

// Executa também ao carregar o Service Worker
configureSidePanelBehavior();
