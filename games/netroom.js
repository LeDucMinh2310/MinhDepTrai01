// Phòng chơi nhiều người (PeerJS, không cần máy chủ riêng): chủ phòng giữ ván và gửi trạng thái,
// khách chỉ gửi thao tác. Cần tải peerjs trước file này.
window.NetRoom = (() => {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);

  // Mã riêng của tab: tải lại trang vẫn giữ (để vào lại đúng ghế), tab khác là người khác
  const cid = (() => {
    const fresh = Math.random().toString(36).slice(2, 10);
    try {
      const c = sessionStorage.getItem('netroom-cid') || fresh;
      sessionStorage.setItem('netroom-cid', c);
      return c;
    } catch { return fresh; }
  })();
  const available = () => typeof window.Peer === 'function';

  // ----- Chủ phòng -----
  // h: { onReady(code), onJoin(member, rejoin), onLeave(member), onData(member, d), onError(msg), canJoin(member) → lỗi | null }
  // member: { cid, name, avatar, online }
  function host(prefix, maxGuests, h) {
    let code = makeCode(), peer = null, closed = false;
    const members = new Map(); // cid → { cid, name, avatar, online, conn }
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
            const info = { name: cleanName(d.name) || 'Bạn mới', avatar: String(d.avatar || '').slice(0, 8) };
            let m = members.get(c);
            if (m) {
              Object.assign(m, info, { conn, online: true });
              h.onJoin(m, true);
              return;
            }
            const err = members.size >= maxGuests ? 'Phòng đã đủ người rồi.' : h.canJoin?.(info);
            if (err) { conn.send({ t: 'reject', msg: err }); setTimeout(() => conn.close(), 500); return; }
            m = { cid: c, ...info, conn, online: true };
            members.set(c, m);
            h.onJoin(m, false);
          } else {
            const m = [...members.values()].find(x => x.conn === conn);
            if (m) h.onData(m, d);
          }
        });
        conn.on('close', () => {
          const m = [...members.values()].find(x => x.conn === conn);
          if (!m) return;
          m.online = false; m.conn = null;
          h.onLeave(m);
        });
      });
    };
    open();
    return {
      get code() { return code; },
      members: () => [...members.values()],
      send(c, d) { const m = members.get(c); try { m?.conn?.open && m.conn.send(d); } catch {} },
      broadcast(d) { members.forEach(m => { try { m.conn?.open && m.conn.send(d); } catch {} }); },
      remove(c) { const m = members.get(c); members.delete(c); try { m?.conn?.close(); } catch {} },
      close() {
        closed = true;
        members.forEach(m => { try { m.conn?.open && m.conn.send({ t: 'closed' }); } catch {} });
        const p = peer;
        setTimeout(() => { try { p?.destroy(); } catch {} }, 300);
      }
    };
  }

  // ----- Khách -----
  // h: { onOpen(), onData(d), onFail(msg) }
  function join(prefix, codeRaw, info, h) {
    const code = cleanCode(codeRaw);
    let conn = null, done = false;
    const p = new Peer();
    const fail = msg => { if (done) return; done = true; try { p.destroy(); } catch {} h.onFail(msg); };
    const timer = setTimeout(() => { if (!conn?.open) fail('Không kết nối được tới phòng. Kiểm tra mã phòng hoặc mạng rồi thử lại.'); }, 15000);
    p.on('open', () => {
      conn = p.connect(prefix + code.toLowerCase(), { reliable: true });
      conn.on('open', () => { clearTimeout(timer); conn.send({ t: 'hello', name: info.name, avatar: info.avatar, cid }); h.onOpen(); });
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

  return { host, join, cid, cleanCode, cleanName, available };
})();
