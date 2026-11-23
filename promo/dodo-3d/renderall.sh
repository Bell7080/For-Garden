cd /tmp/claude-0/d3
run(){ node shot.cjs "scenes.html?s=$1" full/$1 $2 > full/$1.log 2>&1; }
mkdir -p full
run island 84 & run forest 100 & run ship 104 & run landing 79 & wait
run tilt 101 & run crate 79 & run pop 82 & run nest 91 & wait
run last 112 & run dissolve 108 & run museum 81 & run painting 106 & wait
echo DONE
