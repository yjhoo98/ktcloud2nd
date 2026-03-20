# DB용 프라이빗 DNS 영역 생성
resource "azurerm_private_dns_zone" "db_dns_zone" {
  name                = "palja.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
}

# DNS 영역을 VNet에 연결
resource "azurerm_private_dns_zone_virtual_network_link" "db_dns_link" {
  name                  = "palja-dns-link"
  private_dns_zone_name = azurerm_private_dns_zone.db_dns_zone.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
  resource_group_name   = azurerm_resource_group.rg.name
}

# PostgreSQL Flexible Server (싱글 노드 구성)
resource "azurerm_postgresql_flexible_server" "postgres_db" {
  name                   = "palja-bootcamp-pg-server"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "14" # 가장 안정적인 14버전 추천
  
  delegated_subnet_id    = azurerm_subnet.db_subnet.id 
  private_dns_zone_id    = azurerm_private_dns_zone.db_dns_zone.id
  
  administrator_login    = "admin"
  administrator_password = "admin123" # 깃허브 시크릿 사용할 예정
  
  storage_mb             = 32768 # 32GB (Flexible Server 최소 허용 용량)
  sku_name               = "B_Standard_B1ms" # 가장 저렴한 싱글 노드용 스펙

  # 백업 보존 기간 (비용 절감을 위해 7일로 최소화)
  backup_retention_days  = 7 

  # DNS 세팅이 완료된 후 DB가 만들어지도록 순서 보장
  depends_on = [azurerm_private_dns_zone_virtual_network_link.db_dns_link]
}
