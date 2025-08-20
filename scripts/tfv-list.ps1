Param(
  [Parameter(Mandatory = $true)]
  [string]$PnSid
)

# Safely check required env vars
$acct = $env:TWILIO_ACCOUNT_SID
$tok  = $env:TWILIO_AUTH_TOKEN
if ([string]::IsNullOrWhiteSpace($acct) -or [string]::IsNullOrWhiteSpace($tok)) {
  Write-Error 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars are required. Example: $env:TWILIO_ACCOUNT_SID="AC..."; $env:TWILIO_AUTH_TOKEN="..."'
  exit 1
}

$pair = "$($acct):$($tok)"
$b64  = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{ Authorization = "Basic $b64" }
$url = "https://messaging.twilio.com/v1/Tollfree/Verifications?TollfreePhoneNumberSid=$PnSid"

try {
  $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
  if ($resp -and $resp.verifications) {
    $resp.verifications | ForEach-Object {
      [PSCustomObject]@{
        sid             = $_.sid
        status          = $_.status
        edit_allowed    = $_.edit_allowed
        edit_expiration = $_.edit_expiration
      }
    } | Format-Table -AutoSize
  } else {
    Write-Host "No TFV records found for $PnSid"
  }
}
catch {
  Write-Error $_
  exit 1
}


