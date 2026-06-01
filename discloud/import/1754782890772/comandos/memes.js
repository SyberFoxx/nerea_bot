module.exports = {
    nombre: 'meme',
    descripcion: 'Envía un meme aleatorio',
    async ejecutar(message) {
      try {
        const res = await fetch('https://meme-api.com/gimme');
        const meme = await res.json();
  
        message.channel.send({
          content: `**${meme.title}**\n🔗 [Ver en Reddit](${meme.postLink})\n📤 Autor: ${meme.author} | 👍 ${meme.ups} | 🧵 r/${meme.subreddit}`,
          files: [meme.url]
        });
  
      } catch (err) {
        console.error('Error al obtener meme:', err);
        message.reply('Hubo un error al obtener el meme 😢');
      }
    }
  };