
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import pino from 'pino';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';

const GROUP_NAME = 'NOMBRE EXACTO DEL GRUPO';

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'open') {
      console.log('Vóley Bot conectado 🏐');

      const groups = await sock.groupFetchAllParticipating();

      for (const group of Object.values(groups)) {
        console.log(group.subject, group.id);
      }

      const target = Object.values(groups).find(
        group => group.subject === GROUP_NAME
      );

      if (!target) {
        console.log('No encuentro el grupo. Revisa el nombre.');
        return;
      }

      console.log('Grupo encontrado:', target.subject);

      if (!global.pollScheduled) {
        global.pollScheduled = true;

        cron.schedule('0 12 * * 2-4', async () => {
          await sock.sendMessage(target.id, {
            poll: {
              name: '¿Quién va a entrenar hoy?',
              values: [
                'Voy',
                'No voy',
                'Llego tarde'
              ],
              selectableCount: 1
            }
          });

          console.log('Encuesta publicada 🏐');
        }, {
          timezone: 'Europe/Madrid'
        });

        console.log('Encuestas programadas.');
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log('Sesión cerrada. Hay que vincular de nuevo.');
      }
    }
  });
}

startBot();
