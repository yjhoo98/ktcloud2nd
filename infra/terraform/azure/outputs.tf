# Broker VM의 Public IP 주소
output "broker_public_ip" {
  description = "Broker VM에 접속하기 위한 공인 IP 주소"
  value       = azurerm_public_ip.broker_ip.ip_address
}