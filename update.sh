cd /var/www/OI-wiki
# sleep 50s
git fetch origin gh-pages
git reset origin/gh-pages --hard
echo $USER

cd /home/ubuntu/OI-wiki
git fetch gh master
git reset gh/master --hard