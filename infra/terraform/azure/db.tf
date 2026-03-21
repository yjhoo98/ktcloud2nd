# DB용 Private DNS 영역 생성
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
  version                = "14"
  
  delegated_subnet_id    = azurerm_subnet.db_subnet.id 
  private_dns_zone_id    = azurerm_private_dns_zone.db_dns_zone.id
  
  administrator_login    = "admin"
  administrator_password = var.db_password
  
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"

  # 백업 보존 기간
  backup_retention_days  = 7 

  # DNS 세팅이 완료된 후 DB가 만들어지도록 순서 보장
  depends_on = [azurerm_private_dns_zone_virtual_network_link.db_dns_link]
}
