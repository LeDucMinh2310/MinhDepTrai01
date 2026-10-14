// Dùng chung cho mọi trang: đăng ký service worker và xử lý các nút có thuộc tính data-install ("Tải app")
(() => {
  const root = document.currentScript.src.replace(/pwa\.js(\?.*)?$/, '');
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register(root + 'sw.js', { scope: root }).catch(() => {}));
  }

  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|Messenger|MicroMessenger|TikTok/i.test(ua);
  let prompt = null;

  const buttons = () => document.querySelectorAll('[data-install]');
  const setVisible = v => buttons().forEach(b => { b.hidden = !v; });

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; setVisible(true); });
  addEventListener('appinstalled', () => { prompt = null; setVisible(false); });

  function helpHtml() {
    if (inApp) return `
      <p>Bạn đang mở trang trong <b>Zalo / Messenger / Facebook</b>, ở đây không cài app được.</p>
      <ol><li>Bấm nút <b>⋯</b> hoặc <b>⋮</b> ở góc trên.</li>
      <li>Chọn <b>Mở bằng trình duyệt</b> (Safari hoặc Chrome).</li>
      <li>Bấm lại nút <b>📲 Tải app</b>.</li></ol>`;
    if (ios) return `
      <p>Trên iPhone / iPad, mở trang bằng <b>Safari</b> rồi:</p>
      <ol><li>Bấm nút <b>Chia sẻ</b> <span style="font-size:20px">⬆︎</span> (ô vuông có mũi tên, ở thanh dưới hoặc trên).</li>
      <li>Kéo xuống, chọn <b>Thêm vào MH chính</b> (Add to Home Screen).</li>
      <li>Bấm <b>Thêm</b> ở góc phải. Icon app sẽ hiện trên màn hình chính.</li></ol>`;
    return `
      <p>Mở trang bằng <b>Chrome</b> rồi:</p>
      <ol><li>Bấm nút <b>⋮</b> ở góc trên bên phải.</li>
      <li>Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</li>
      <li>Bấm <b>Cài đặt</b>. Icon app sẽ hiện trên màn hình chính.</li></ol>`;
  }

  function showHelp() {
    let d = document.getElementById('pwaHelp');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'pwaHelp';
      d.style.cssText = 'border:0;border-radius:22px;padding:22px;width:min(400px,calc(100% - 32px));'
        + 'background:var(--card,#fff);color:var(--text,#1d1d1f);font:16px/1.5 inherit';
      document.body.appendChild(d);
    }
    d.innerHTML = `<h2 style="margin:0 0 8px;font-size:21px;text-align:center">📲 Tải app về điện thoại</h2>
      <div style="color:var(--muted,#6e6e73)">${helpHtml()}</div>
      <button style="width:100%;margin-top:10px;padding:14px;border:0;border-radius:14px;background:var(--accent,#0a84ff);
        color:#fff;font:inherit;font-weight:800;cursor:pointer">Đã hiểu</button>`;
    d.querySelectorAll('ol').forEach(o => { o.style.paddingLeft = '22px'; });
    d.querySelector('button').onclick = () => d.close();
    d.showModal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setVisible(!standalone); // đang mở trong app rồi thì ẩn nút
    buttons().forEach(b => b.addEventListener('click', async () => {
      if (!prompt) return showHelp();
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      prompt = null;
      if (outcome === 'accepted') setVisible(false);
    }));
  });
})();
