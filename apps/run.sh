#!/bin/bash
count=$1
i=1
params=""
while [ $i -le $count ]; do
  p=$((3000 + $i))
  params="$params $i localhost:$p"
  i=$(($i+1))
done

i=1
while [ $i -lt $count ]; do
  node $2$params $i > "log$i.log" &
  i=$(($i+1))
done

node $2$params $i > "log$i.log" # last call is blocking

kill $(ps aux | grep "node $2" | awk '{ print $2}')

