#!/bin/sh
# Otomatik güncelleyici: GitHub'daki main dalını belirli aralıklarla denetler; yeni
# sürüm varsa çeker ve "docker compose up -d --build" ile uygulamayı yeniden kurar.
#
# docker-compose.yml'deki "guncelleyici" hizmeti olarak çalışır. Proje klasörü bu
# kapsayıcıya sunucudaki yoluyla aynı yolda bağlanır; böylece compose proje adı ve
# veritabanı biriminin (volume) adı değişmez, veri yerinde kalır.
#
# Ayarlar (ortam değişkenleri):
#   GUNCELLEME_ARALIGI   saniye, varsayılan 300 (5 dakika)
#   GUNCELLEME_DALI      varsayılan main

ARALIK="${GUNCELLEME_ARALIGI:-300}"
DAL="${GUNCELLEME_DALI:-main}"
GUNCELLEYICI="guncelleyici"

log() { echo "[güncelleyici $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1 || { log "git kurulamadı"; }
git config --global --add safe.directory '*' 2>/dev/null

kur() {
  # Güncelleyicinin kendisi dışındaki hizmetler yeniden kurulur
  hizmetler=$(docker compose config --services | grep -v "^${GUNCELLEYICI}\$" | tr '\n' ' ')
  # shellcheck disable=SC2086
  docker compose up -d --build --remove-orphans $hizmetler && docker image prune -f >/dev/null 2>&1
}

if [ ! -d .git ]; then
  log "Proje klasörü bir git deposu değil ($(pwd)); otomatik güncelleme yapılamaz. Klasör 'git clone' ile kurulmalıdır."
fi

ilk=1
while true; do
  if [ -d .git ]; then
    if git fetch -q origin "$DAL" 2>/tmp/hata; then
      yerel=$(git rev-parse HEAD)
      uzak=$(git rev-parse "origin/$DAL")
      if [ "$yerel" != "$uzak" ]; then
        log "Yeni sürüm: $(git log -1 --format='%h %s' "origin/$DAL")"
        if git reset -q --hard "origin/$DAL"; then
          log "Yeniden kuruluyor (docker compose up -d --build)…"
          if kur; then log "Güncelleme tamamlandı."; else log "Kurulum başarısız; bir sonraki denetimde yeniden denenecek."; git reset -q --hard "$yerel"; fi
        fi
      elif [ "$ilk" = 1 ]; then
        # Güncelleyici ilk açıldığında çalışan imaj koddan eskiyse (ör. elle git pull yapılıp
        # yeniden kurulmamışsa) bir kez kurulur.
        log "Güncel: $(git log -1 --format='%h %s')"
        kur >/dev/null 2>&1 && log "Kapsayıcılar kod ile eşitlendi."
      fi
    else
      log "GitHub'a ulaşılamadı: $(cat /tmp/hata | head -1)"
    fi
  fi
  ilk=0
  sleep "$ARALIK"
done
