Pod::Spec.new do |s|
  s.name           = 'ExpoVault'
  s.version        = '1.0.0'
  s.summary        = 'AES-GCM vault with a Keychain-protected key for SecureVault'
  s.description    = 'Expo module that encrypts SecureVault documents with a Keychain-protected key'
  s.author         = 'Nadir Alfakesh'
  s.homepage       = 'https://github.com/naderalfakesh/secure-vault'
  # iOS only: the module needs LocalAuthentication, the Keychain with user
  # presence, and UIPasteboard.
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/naderalfakesh/secure-vault.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
