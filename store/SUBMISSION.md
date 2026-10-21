# Como enviar o History Plus para a Chrome Web Store

Roteiro do envio no [Painel do desenvolvedor](https://chrome.google.com/webstore/devconsole), campo a campo. Os textos para colar estão em [`listing.en.md`](listing.en.md) e [`listing.pt_BR.md`](listing.pt_BR.md).

## 0. Antes de começar

- Conta de desenvolvedor da Chrome Web Store registrada (taxa única de US$ 5) e com o e-mail de contato verificado.
- Pacote gerado com `tools/package.sh`, em `dist/history-plus-<versão>.zip`.

## 1. Enviar o pacote

**Itens → Novo item** e envie o `.zip`. A loja lê nome, resumo, ícone e versão do manifest.

## 2. Página da loja (Store listing)

O idioma padrão do pacote é **inglês** (`default_locale: "en"`). Preencha primeiro em inglês e depois adicione **Português (Brasil)** no seletor de idioma da página, repetindo os campos com o conteúdo de `listing.pt_BR.md` e as imagens de `store/images/pt_BR/`.

| Campo | O que usar |
| --- | --- |
| Descrição | Bloco "Description" / "Descrição" |
| Categoria | Productivity → Tools (Produtividade → Ferramentas) |
| Idioma | English; depois Português (Brasil) |
| Ícone da loja (128×128) | `icons/icon-128.png` |
| Capturas de tela | As 4 `screenshot-*.png` do idioma, na ordem numerada |
| Bloco promocional pequeno | `promo-small-440x280.png` |
| Bloco promocional de marquee | `promo-marquee-1400x560.png` (opcional; usado se o Google destacar a extensão) |
| Site oficial | `https://github.com/israelfsilva/chrome-history-plus` |
| URL de suporte | `https://github.com/israelfsilva/chrome-history-plus/issues` |

## 3. Práticas de privacidade (Privacy practices)

**Finalidade única (Single purpose)**

```
Show the user's Chrome browsing history in the side panel and let them search it, filter it by day or date range, open pages and remove entries.
```

**Justificativas das permissões**

| Permissão | Justificativa |
| --- | --- |
| `history` | `Required to read, search and filter the user's browsing history by date (including each visit's time via history.getVisits) and to remove an entry when the user clicks Remove.` |
| `sidePanel` | `The extension's entire interface is displayed in Chrome's side panel, opened from the toolbar icon.` |
| `favicon` | `Shows each history entry's site icon, read from Chrome's local favicon cache (chrome-extension://<id>/_favicon/), so the list is easy to scan.` |

**Código remoto**: _"No, I am not using remote code."_ Todo o JavaScript está no pacote.

**Uso de dados**: marque **Web history** (histórico da web), porque a extensão lê o histórico de navegação, mesmo que só no dispositivo. Depois marque as três certificações:

- Não vendo nem transfiro dados de usuários a terceiros, fora dos casos de uso aprovados.
- Não uso nem transfiro dados de usuários para finalidades não relacionadas à finalidade única do item.
- Não uso nem transfiro dados de usuários para determinar crédito ou conceder empréstimos.

**URL da política de privacidade**

```
https://github.com/israelfsilva/chrome-history-plus/blob/main/PRIVACY.md
```

## 4. Distribuição

- **Visibilidade**: Pública (ou "Não listada" para testar antes com um link).
- **Regiões**: Todas.
- Preço: gratuito.

## 5. Enviar para revisão

Clique em **Enviar para revisão**. Extensões com a permissão `history` costumam passar por revisão manual, que pode levar alguns dias.

## Atualizações futuras

1. Aumente `version` no `manifest.json` e registre a mudança no `CHANGELOG.md`.
2. Se a interface mudou, regenere as imagens com `tools/store-images/build.sh`.
3. Rode `tools/package.sh` e envie o novo `.zip` em **Pacote → Enviar nova versão**.
