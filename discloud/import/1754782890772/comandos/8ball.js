module.exports = {
  nombre: "8ball",
  ejecutar: (message, args) => {
    if (args.length === 0) {
      message.reply("Hazme una pregunta.");
      return;
    }

    const respuestas = [
      "Sí.",
      "No.",
      "Tal vez.",
      "Definitivamente sí.",
      "No cuentes con ello.",
      "Probablemente.",
      "Pregunta de nuevo más tarde.",
      "No puedo decirte ahora.",
    ];
    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    message.reply(`🎱 ${respuesta}`);
  },
};
