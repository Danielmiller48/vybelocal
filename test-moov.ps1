# Moov API Testing Script
# Replace these with your actual Moov credentials
$publicKey = "YOUR_PUBLIC_KEY"
$privateKey = "YOUR_PRIVATE_KEY" 
$accountId = "829aa10b-aa22-4189-ae65-0a30fb3f586b"
$facilitator = "17963f1c-3e21-413e-a1ee-6f0fa917e46a"
$moovBase = "https://api.moov.io"  # or https://api-sandbox.moov.io

Write-Host "=== Testing Moov Token Generation ===" -ForegroundColor Yellow

# Test 1: Generate token with account scopes (same as your app does)
$scopes = "/accounts.write /accounts/$facilitator/profile.read /fed.read /profile-enrichment.read /accounts/$accountId/bank-accounts.read /accounts/$accountId/bank-accounts.write /accounts/$accountId/capabilities.read /accounts/$accountId/capabilities.write /accounts/$accountId/cards.read /accounts/$accountId/cards.write /accounts/$accountId/profile.read /accounts/$accountId/profile.write /accounts/$accountId/representatives.read /accounts/$accountId/representatives.write"

$tokenBody = @{
    grant_type = "client_credentials"
    client_id = $publicKey  
    client_secret = $privateKey
    scope = $scopes
} | ConvertTo-Json

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${publicKey}:${privateKey}"))

try {
    $tokenResponse = Invoke-RestMethod -Uri "$moovBase/oauth2/token" -Method Post -Headers @{
        "Authorization" = "Basic $auth"
        "Content-Type" = "application/x-www-form-urlencoded"
        "Accept" = "application/json"
    } -Body "grant_type=client_credentials&client_id=$publicKey&client_secret=$privateKey&scope=$([uri]::EscapeDataString($scopes))"
    
    Write-Host "✅ Token generated successfully!" -ForegroundColor Green
    Write-Host "Token: $($tokenResponse.access_token.Substring(0,20))..." -ForegroundColor Gray
    Write-Host "Scopes: $($tokenResponse.scope)" -ForegroundColor Gray
    
    $token = $tokenResponse.access_token
} catch {
    Write-Host "❌ Token generation failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Testing Capabilities Request ===" -ForegroundColor Yellow

# Test 2: Request capabilities using the generated token
$capsBody = @{
    capabilities = @{
        wallet = @{ requested = $true }
        "collect-funds" = @{ requested = $true }
    }
} | ConvertTo-Json -Depth 3

try {
    $capsResponse = Invoke-RestMethod -Uri "$moovBase/accounts/$accountId/capabilities" -Method Patch -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -Body $capsBody
    
    Write-Host "✅ Capabilities requested successfully!" -ForegroundColor Green
    Write-Host ($capsResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "❌ Capabilities request failed!" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    
    # Try to read the response body for more details
    try {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Error details: $responseBody" -ForegroundColor Red
    } catch {
        Write-Host "Could not read error response" -ForegroundColor Red
    }
}

Write-Host "`n=== Testing MCC Update ===" -ForegroundColor Yellow

# Test 3: Set MCC using the token
$mccBody = @{
    businessProfile = @{
        mcc = "7922"
    }
} | ConvertTo-Json -Depth 3

try {
    $mccResponse = Invoke-RestMethod -Uri "$moovBase/accounts/$accountId/profile" -Method Patch -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
        "x-moov-version" = "v2024.01.00"
    } -Body $mccBody
    
    Write-Host "✅ MCC set successfully!" -ForegroundColor Green
    Write-Host ($mccResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "❌ MCC update failed!" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    
    # Try to read the response body
    try {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Error details: $responseBody" -ForegroundColor Red
    } catch {
        Write-Host "Could not read error response" -ForegroundColor Red
    }
}
