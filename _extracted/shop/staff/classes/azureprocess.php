<?php
require '../../vendor/autoload.php';

use TheNetworg\OAuth2\Client\Provider\Azure;

session_start();

$provider = new Azure([
    'clientId'          => '6eab5ff8-d33c-4a45-9633-6c44b1ac7d0f',
    'clientSecret' = getenv('AZURE_CLIENT_SECRET'),
    'redirectUri'       => 'https://join.shopkillieicehockey.com/staff/classes/azurecall.php',
    'tenant'            => '4a2b4002-7f23-4308-bfb6-d590461589f7',
    'urlAuthorize'      => 'https://login.microsoftonline.com/common/oauth2/authorize',
    'urlAccessToken'    => 'https://login.microsoftonline.com/common/oauth2/token',
    'urlResourceOwnerDetails' => '',
]);

if (!isset($_GET['code'])) {
    $authUrl = $provider->getAuthorizationUrl([
        'scope' => ['openid', 'profile', 'email'],
    ]);
    $_SESSION['oauth2state'] = $provider->getState();
    header('Location: ' . $authUrl);
    exit;
} elseif (empty($_GET['state']) || ($_GET['state'] !== $_SESSION['oauth2state'])) {
    unset($_SESSION['oauth2state']);
    exit('Invalid state');
}
?>
