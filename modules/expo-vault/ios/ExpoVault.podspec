Pod::Spec.new do |s|
  s.name           = 'ExpoVault'
  s.version        = '1.0.0'
  s.summary        = 'Hardware-backed AES-GCM vault for SecureVault'
  s.description    = 'Expo module that encrypts SecureVault documents with a Keychain-protected key'
  s.author         = 'Nadir Alfakesh'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
