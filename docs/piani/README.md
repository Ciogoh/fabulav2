# I piani

Ogni cambiamento grosso di Fabula nasce da un piano scritto **prima** di
toccare il codice: cosa si vuole ottenere, perché, e quali trappole sono già
state trovate ragionandoci. Restano qui anche dopo, perché il codice dice
*com'è fatto* e il piano dice *perché è fatto così* — e la seconda domanda
arriva sempre dopo, quando chi l'ha deciso non se lo ricorda più.

I nomi dei file cominciano con la data in cui il piano è stato scritto.

| Piano | Stato |
| --- | --- |
| [Il badge del catalogo risponde a «adesso»](2026-08-22-badge-catalogo.md) — perché `RESERVED` non poteva restare un colore solo | ✅ fatto |
| [Promemoria automatico, notifiche e il resto del brainstorm](2026-08-22-promemoria-e-brainstorm.md) — le email in un posto solo, lo spazzatore orario, le azioni del dettaglio richiesta | ✅ fatto |
| [Intestazione mobile](2026-08-24-intestazione-mobile.md) — bersagli di tocco da 44px e menu lingua raccolto in un pulsante | ✅ fatto |
| [Registro admin, storico dell'oggetto, QR e consegna diretta](2026-08-24-registro-storico-qr.md) — tre passi in un piano solo | ✅ fatto |
| [Numero di versione e archivio dei piani](2026-08-24-versione-e-archivio-piani.md) — `0.5.0 · build 27`, il CHANGELOG, e questa cartella | 🔄 in corso |
| [La foto del profilo si cambia premendo la foto](2026-08-24-foto-profilo-premibile.md) — l'invito era il «Scegli file» del browser, cioè nessun invito | ✅ fatto |
| [PWA installabile e notifiche al posto delle email](2026-08-24-pwa-notifiche.md) — il guscio, il motore push, la scelta del canale nel profilo | ✅ fatto — il prerequisito del rebrand è caduto: dipendeva dal logo, non dall'interfaccia. Resta la prova su dispositivi veri |
| [Il Centro, la chat dal vivo e i promemoria](2026-08-28-centro-chat-promemoria.md) — sei cose che rendono la piattaforma usabile da volontari che si alternano | ✅ fatto |
| [L'arretrato](2026-08-28-arretrato.md) — calendario personale, guide e manuali, backup su R2, tunnel, Telegram, documenti, CI: cosa resta e come si fa | ⏳ da fare |

## Come si aggiunge un piano

Claude Code scrive i piani in `~/.claude/plans/` con un nome generato a caso
(`rosy-seeking-kazoo.md`). **Quello è fuori dal repo**: fuori da git, fuori dal
backup, e con un nome che fra sei mesi non dice niente. Alla fine di una
sessione di pianificazione il file va spostato qui e rinominato
`AAAA-MM-GG-argomento.md`, con una riga nella tabella qui sopra.

Quando un piano è finito: si segna ✅, si alza il numero di versione e si
scrive la voce nel [CHANGELOG](../../CHANGELOG.md). Vedi il capitolo
*Versione* di [`CLAUDE.md`](../../CLAUDE.md).
