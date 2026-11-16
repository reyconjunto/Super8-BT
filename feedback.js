(() => {
 let sending = false;
 App.sendFeedback = async event => {
  event?.preventDefault();
  if (sending) return;
  const el = id => document.getElementById(id);
  const name = el('feedback-name-input').value.trim();
  const contact = el('feedback-contact-input').value.trim();
  const message = el('feedback-message-input').value.trim();
  const status = el('feedback-status-msg'), button = el('btn-send-feedback');
  const show = (text, color) => { status.textContent = text; status.style.color = color; status.style.display = 'block'; };
  if (!message) { show('Digite a sua mensagem antes de enviar.', '#fbbf24'); return; }
  sending = true; button.disabled = true;
  show('Enviando mensagem… Aguarde até 20 segundos.', 'var(--sand-light)');
  const controller = new AbortController();
  let timer;
  try {
   const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 20000);
   });
   const request = (async () => {
    const response = await fetch('https://formsubmit.co/ajax/rodrirey@gmail.com', {
     method: 'POST', signal: controller.signal,
     headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
     body: JSON.stringify({ name: name || 'Anônimo', contact: contact || 'Não informado', message, _subject: 'Super 8 BT - Nova Sugestão / Feedback' })
    });
    if (!response.ok) throw new Error('http');
    const result = await response.json();
    if (result.success !== true && result.success !== 'true') throw new Error('rejected');
   })();
   await Promise.race([request, timeout]);
   show('Mensagem aceita pelo serviço de envio para rodrirey@gmail.com. A entrega na caixa de entrada pode levar alguns minutos. O contato informado não recebe cópia automática.', '#34d399');
   if (el('feedback-message-input').value.trim() === message) el('feedback-message-input').value = '';
  } catch (error) {
   show('Não foi possível confirmar o envio. Seu texto foi mantido. Confira a caixa de entrada antes de tentar novamente para evitar duplicidade. Você também pode enviar pelo seu aplicativo de e-mail: ', '#fbbf24');
   const link = document.createElement('a');
   link.textContent = 'Abrir e-mail para enviar';
   link.href = 'mailto:rodrirey@gmail.com?subject=' + encodeURIComponent('Rey Play - Feedback') + '&body=' + encodeURIComponent(`Nome: ${name}\nContato: ${contact}\n\n${message}`);
   link.style.color = 'inherit';
   status.append(link);
  } finally { clearTimeout(timer); sending = false; button.disabled = false; }
 };
})();
