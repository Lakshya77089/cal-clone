git push
if ($LASTEXITCODE -ne 0) { Write-Host "push failed, aborting"; exit 1 }
ssh root@139.84.222.82 "bash ~/deploy.sh"
