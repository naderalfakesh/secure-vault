Pod::Spec.new do |s|
  s.name           = 'ExpoDocumentScanner'
  s.version        = '1.0.0'
  s.summary        = 'VisionKit document camera for SecureVault'
  s.description    = 'Expo module that presents VNDocumentCameraViewController and returns perspective-corrected pages'
  s.author         = 'Nadir Alfakesh'
  s.homepage       = 'https://github.com/naderalfakesh/secure-vault'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'VisionKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
