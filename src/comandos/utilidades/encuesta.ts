import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'encuesta',
  descripcion: 'Crea una encuesta con opciones',
  uso: '!encuesta <pregunta> | <opción1> | <opción2> | ...',
  ejecutar: async (message, args) => {
    if (args.length < 3)
      return message.reply('Uso: !encuesta <pregunta> | <opción1> | <opción2> | ...');

    const pregunta = args.shift()!;
    const opciones = args.join(' ').split('|').map(o => o.trim());

    let texto = `📊 **Encuesta**: ${pregunta}\n\n`;
    opciones.forEach((opcion, i) => { texto += `${i + 1}. ${opcion}\n`; });

    const msg = await (message.channel as any).send(texto);
    for (let i = 0; i < opciones.length; i++) {
      await msg.react(`${i + 1}️⃣`);
    }
  },
};

export default comando;
