// Kết nối 2 người cho các game theo lượt (PeerJS, không cần máy chủ riêng).
// Chủ phòng giữ ván và gửi trạng thái; khách chỉ gửi nước đi. Cần tải peerjs trước file này.
window.Net2P = (() => {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

  // Mã riêng của tab: tải lại trang vẫn giữ (để vào lại đúng chỗ), tab khác là người khác
  const cid = (() => {
    const fresh = Math.random().toString(36).slice(2, 10);
    try {
      const c = sessionStorage.getItem('net2p-cid') || fresh;
      sessionStorage.setItem('net2p-cid', c);
      return c;
    } catch { return fresh; }
  })();

  const available = () => typeof window.Peer === 'function';

  // ----- Chủ phòng -----
  // h: { onReady(code), onJoin(info, isRejoin), onLeave(), onData(d), onError(msg) }
  function host(prefix, h) {
    let code = makeCode(), peer = null, guest = null, guestCid = null, closed = false;
    const open = () => {
      const p = peer = new Peer(prefix + code.toLowerCase());
      p.on('open', () => { if (peer === p) h.onReady(code); });
      p.on('error', e => {
        if (peer !== p || closed) return;
        if (e.type === 'unavailable-id') { p.destroy(); code = makeCode(); open(); return; }
        if (e.type === 'peer-unavailable') return;
        h.onError('Lỗi kết nối: ' + (e.type || e.message));
      });
      p.on('disconnected', () => { if (peer === p && !p.destroyed && !closed) setTimeout(() => { try { p.reconnect(); } catch {} }, 1000); });
      p.on('connection', conn => {
        conn.on('data', d => {
          if (!d || typeof d !== 'object') return;
          if (d.t === 'hello') {
            const c = String(d.cid || '').slice(0, 20);
            if (guestCid && c !== guestCid && guest?.open) {
              conn.send({ t: 'reject', msg: 'Phòng đã đủ 2 người rồi.' });
              setTimeout(() => conn.close(), 500);
              return;
            }
            const rejoin = guestCid === c;
            guest = conn; guestCid = c;
            h.onJoin({ name: String(d.name || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Bạn mới' }, rejoin);
          } else if (conn === guest) h.onData(d);
        });
        conn.on('close', () => { if (conn === guest) { guest = null; h.onLeave(); } });
      });
    };
    open();
    return {
      get code() { return code; },
      get connected() { return !!guest?.open; },
      send(d) { try { guest?.open && guest.send(d); } catch {} },
      close() {
        closed = true;
        try { guest?.open && guest.send({ t: 'closed' }); } catch {}
        const p = peer;
        setTimeout(() => { try { p?.destroy(); } catch {} }, 300);
      }
    };
  }

  // ----- Khách -----
  // h: { onOpen(), onData(d), onFail(msg) }
  function join(prefix, codeRaw, name, h) {
    const code = cleanCode(codeRaw);
    let conn = null, done = false;
    const p = new Peer();
    const fail = msg => { if (done) return; done = true; try { p.destroy(); } catch {} h.onFail(msg); };
    const timer = setTimeout(() => { if (!conn?.open) fail('Không kết nối được tới phòng. Kiểm tra mã phòng hoặc mạng rồi thử lại.'); }, 15000);
    p.on('open', () => {
      conn = p.connect(prefix + code.toLowerCase(), { reliable: true });
      conn.on('open', () => { clearTimeout(timer); conn.send({ t: 'hello', name, cid }); h.onOpen(); });
      conn.on('data', d => {
        if (!d || typeof d !== 'object') return;
        if (d.t === 'reject') fail(String(d.msg));
        else if (d.t === 'closed') fail('Chủ phòng đã đóng phòng.');
        else h.onData(d);
      });
      conn.on('close', () => fail('Mất kết nối với chủ phòng.'));
    });
    p.on('error', e => fail(e.type === 'peer-unavailable'
      ? `Không tìm thấy phòng ${code}. Có thể chủ phòng đã thoát hoặc mã sai.` : 'Lỗi kết nối: ' + e.type));
    return {
      code,
      send(d) { try { conn?.open && conn.send(d); } catch {} },
      close() { done = true; clearTimeout(timer); try { p.destroy(); } catch {} }
    };
  }

  return { host, join, cid, makeCode, cleanCode, available };
})();
