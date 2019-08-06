## */1 * * * * /bin/bash /home/ubuntu/restart_es.sh >> /home/ubuntu/es_log/crontab.log  2>&1

ES_ID=`ps -ef |grep elasticsearch |grep -v 'grep'|awk '{print $2}'`
# ES_ID=`ps -ef |grep elasticsearch |grep -w 'elasticsearch-master'|grep -v 'grep'|awk '{print $2}'`

ESMonitorLog=/home/ubuntu/es_log/crontab.log
Monitor()
{
  if [[ ! $ES_ID ]];then # 这里判断ES进程是否存在
    # echo "[info] elasticsearch running: $ES_ID"
    # else
    echo "[error] els down, restarting"
    /etc/init.d/elasticsearch restart
    # service elasticsearch restart
    date +%Y%m%d%H%M%S
    sleep 30
    ES_ID=`ps -ef |grep elasticsearch |grep -v 'grep'|awk '{print $2}'`
    echo "running at $ES_ID"
  fi
}

Monitor>>$ESMonitorLog

