import { Comando } from '../types';

interface MemeResponse {
  title: string;
  postLink: string;
  author: string;
  ups: number;
  subreddit: string;
  url: string;
}

const comando: Comando = {
  nombre: 'meme',
  descripcion: 'Envía un meme aleatorio de Reddit',
  uso: '!meme',
  ejecutar: async (message) => {
    try {
      const res = await fetch('https://meme-api.com/gimme');
      const meme = await res.json() as MemeResponse;

      (message.channel as any).send({
        content: `**${meme.title}**\n🔗 [Ver en Reddit](${meme.postLink})\n📤 Autor: ${meme.author} | 👍 ${meme.ups} | 🧵 r/${meme.subreddit}`,
        files: [meme.url],
      });
    } catch (err) {
      console.error('Error al obtener meme:', err);
      message.reply('Hubo un error al obtener el meme 😢');
    }
  },
};

export default comando;
