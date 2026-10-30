/* AI 집사 타입: 화면 간 공유 및 저장. 집 모양 대화 버튼은 공통 진입점. */
(function () {
  'use strict';
  var KEY = 'kj:botType';
  var assets = {
    butler: { avatar: 'assets/kimjipsa-avatar.png', full: 'assets/kimjipsa-dog-bird.png', icon: 'assets/kimjipsa-app-icon-1024.png', label: '집사' },
    nobi: { avatar: 'assets/nobi/nobi-avatar-dark.png', full: 'assets/nobi/nobi-full.png', icon: 'assets/nobi/nobi-avatar-dark.png', label: '노비' }
  };
  var type = 'nobi';
  try { var savedType = localStorage.getItem(KEY); if (assets[savedType]) type = savedType; } catch (_) {}
  function apply(root) {
    (root || document).querySelectorAll('[data-character-image]').forEach(function (img) {
      var role = img.dataset.characterImage;
      img.src = assets[type][role] || assets[type].avatar;
      img.alt = assets[type].label + (role === 'avatar' ? ' 채팅 썸네일' : ' 캐릭터');
      img.dataset.botType = type;
    });
    document.querySelectorAll('[data-character-download]').forEach(function (a) { a.href = assets[type][a.dataset.characterDownload]; });
    document.querySelectorAll('[data-character-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.characterType === type)); });
  }
  window.KJCharacter = {
    getType: function () { return type; },
    asset: function (role) { return assets[type][role]; },
    apply: apply,
    setType: function (next) {
      if (!assets[next]) return;
      type = next;
      try { localStorage.setItem(KEY, type); } catch (_) {}
      apply();
    }
  };
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) {
      type = assets[e.newValue] ? e.newValue : 'nobi';
      apply();
    }
  });
  apply();
})();
