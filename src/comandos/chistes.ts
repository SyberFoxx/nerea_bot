import { Comando } from '../types';

const comando: Comando = {
  nombre: 'chiste',
  descripcion: 'Cuenta un chiste de programación',
  uso: '!chiste',
  ejecutar: (message) => {
    const chistes: string[] = [
      '¿Por qué los programadores confunden Halloween con Navidad? Porque OCT 31 = DEC 25.',
      '¿Qué le dice un bit al otro? Nos vemos en el bus.',
      '—¡Estás obsesionado con la programación! —¿Qué te hace pensar eso? —¡if (obsesion) return true!',
    ];

    const aleatorio = chistes[Math.floor(Math.random() * chistes.length)];
    message.reply(aleatorio);
  },
};

export default comando;
