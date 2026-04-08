#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════
#   منصة مع جابر - المثبّت الذكي التلقائي
#   الاستخدام: bash <(curl -sSL https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/install.sh)
# ══════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }
info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
section() { echo -e "\n${CYAN}${BOLD}══ $1 ══${NC}\n"; }

# ── التحقق من الصلاحيات ─────────────────────────────────────
[ "$EUID" -ne 0 ] && error "يرجى التشغيل بصلاحيات المدير: sudo bash install.sh"

# ── استقبال معلومات المشروع ──────────────────────────────────
clear
echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║     منصة مع جابر - التثبيت التلقائي    ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  سيتم تثبيت وإعداد كل شيء تلقائياً في دقائق.\n"

read -p "  🔗 رابط مستودع GitHub (مثال: https://github.com/user/repo): " REPO_URL
read -p "  🌐 النطاق أو IP الخادم (مثال: myapp.com أو 1.2.3.4): " DOMAIN
read -sp " 🔑 كلمة سر قاعدة البيانات: " DB_PASS; echo
read -sp " 🛡️  كلمة سر الجلسات (اتركها فارغة لتوليدها تلقائياً): " SESSION_SEC; echo

# توليد الأسرار تلقائياً إن تُركت فارغة
[ -z "$SESSION_SEC" ] && SESSION_SEC=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)

APP_DIR="/opt/mitgaber"
APP_USER="mitgaber"
DB_NAME="mitgaber"
DB_USER="mitgaber"

# ══════════════════════════════════════════════════════════════
section "1/7 تحديث النظام وتثبيت المتطلبات"
# ══════════════════════════════════════════════════════════════
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql openssl ufw

# Node.js 20
if ! command -v node &>/dev/null; then
  info "تثبيت Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
  apt-get install -y -qq nodejs
fi

# PM2
npm install -g pm2 &>/dev/null
log "تم تثبيت المتطلبات"

# ══════════════════════════════════════════════════════════════
section "2/7 إعداد قاعدة البيانات"
# ══════════════════════════════════════════════════════════════
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
log "تم إعداد قاعدة البيانات"

# ══════════════════════════════════════════════════════════════
section "3/7 نسخ المشروع وبناؤه"
# ══════════════════════════════════════════════════════════════
useradd -r -s /bin/bash -d $APP_DIR $APP_USER 2>/dev/null || true

if [ -d "$APP_DIR" ]; then
  warn "المجلد موجود - جاري التحديث..."
  cd $APP_DIR && sudo -u $APP_USER git pull
else
  git clone "$REPO_URL" "$APP_DIR"
  chown -R $APP_USER:$APP_USER $APP_DIR
fi

cd $APP_DIR

# إنشاء ملف البيئة تلقائياً
cat > $APP_DIR/.env << ENV
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
SESSION_SECRET=$SESSION_SEC
GITHUB_WEBHOOK_SECRET=$WEBHOOK_SECRET
ENV

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# البناء
info "تثبيت المكتبات وبناء المشروع..."
sudo -u $APP_USER npm install --production=false --silent
sudo -u $APP_USER npm run build
log "تم بناء المشروع"

# ══════════════════════════════════════════════════════════════
section "4/7 تهجير قاعدة البيانات"
# ══════════════════════════════════════════════════════════════
cd $APP_DIR && sudo -u $APP_USER npm run db:push 2>/dev/null || warn "تخطي تهجير قاعدة البيانات - قد تحتاج لتشغيله يدوياً"
log "تم تهجير قاعدة البيانات"

# ══════════════════════════════════════════════════════════════
section "5/7 إعداد PM2 لإدارة التطبيق"
# ══════════════════════════════════════════════════════════════
cat > $APP_DIR/ecosystem.config.cjs << PM2
module.exports = {
  apps: [{
    name: 'mitgaber',
    script: 'dist/index.cjs',
    cwd: '$APP_DIR',
    user: '$APP_USER',
    env_file: '$APP_DIR/.env',
    restart_delay: 5000,
    max_restarts: 10,
    log_file: '$APP_DIR/logs/app.log',
    error_file: '$APP_DIR/logs/error.log',
    time: true
  }]
};
PM2

sudo -u $APP_USER pm2 start $APP_DIR/ecosystem.config.cjs
sudo -u $APP_USER pm2 save
pm2 startup systemd -u $APP_USER --hp $APP_DIR | tail -1 | bash
log "تم تشغيل التطبيق"

# ══════════════════════════════════════════════════════════════
section "6/7 إعداد NGINX كـ Reverse Proxy"
# ══════════════════════════════════════════════════════════════
cat > /etc/nginx/sites-available/mitgaber << NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mitgaber /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log "تم إعداد NGINX"

# ══════════════════════════════════════════════════════════════
section "7/7 إعداد جدار الحماية"
# ══════════════════════════════════════════════════════════════
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
log "تم إعداد جدار الحماية"

# ══════════════════════════════════════════════════════════════
# ملخص التثبيت
# ══════════════════════════════════════════════════════════════
clear
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║         ✅ اكتمل التثبيت بنجاح!              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  🌐 التطبيق يعمل على: ${CYAN}http://$DOMAIN${NC}"
echo -e "  📊 حالة التطبيق:     ${CYAN}pm2 status${NC}"
echo ""
echo -e "${YELLOW}${BOLD}  ═══ خطوة أخيرة: تفعيل التحديث التلقائي ═══${NC}"
echo -e "  اذهب لمستودع GitHub ← Settings ← Webhooks ← Add webhook"
echo -e "  Payload URL: ${CYAN}http://$DOMAIN/api/deploy/webhook${NC}"
echo -e "  Secret:      ${CYAN}$WEBHOOK_SECRET${NC}"
echo ""
echo -e "${GREEN}  بعدها كل 'git push' = تحديث تلقائي فوري! 🚀${NC}"
echo ""
