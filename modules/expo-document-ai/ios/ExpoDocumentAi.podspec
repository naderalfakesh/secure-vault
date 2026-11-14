Pod::Spec.new do |s|
  s.name           = 'ExpoDocumentAi'
  s.version        = '1.0.0'
  s.summary        = 'On-device document suggestions with Apple Foundation Models for SecureVault'
  s.description    = 'Expo module that asks the on-device Foundation Model for a document title, category, dates and number'
  s.author         = 'Nadir Alfakesh'
  s.homepage       = 'https://github.com/naderalfakesh/secure-vault'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: 'https://github.com/naderalfakesh/secure-vault.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Weak: the app still launches on iOS 16 to 25, where the framework is absent.
  s.weak_frameworks = 'FoundationModels'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
