@echo off
ssh -o StrictHostKeyChecking=no root@103.245.237.48 -R 4444:localhost:14444 -R 8000:localhost:8000
pause
