#!/bin/bash
set -e

echo "🚀 [$(date)] بدء التحديث التلقائي..."

echo "📥 سحب آخر تحديثات..."
git fetch origin main
git reset --hard origin/main

echo "📦 تثبيت المكتبات..."
npm install --production=false

echo "🔨 بناء المشروع..."
npm run build

echo "✅ [$(date)] اكتمل التحديث بنجاح!"
