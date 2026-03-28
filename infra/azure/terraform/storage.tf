resource "random_string" "storage_suffix" {
  length  = 6
  special = false
  upper   = false
}

# 원본 데이터 저장 스토리지 계정 생성
resource "azurerm_storage_account" "raw_storage" {
  name                     = "vehicleraw${random_string.storage_suffix.result}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS" # 비용 최적화: LRS (Locally Redundant Storage)

  # 일반 스토리지를 Data Lake Gen2로 변경
  is_hns_enabled           = true

  network_rules {
    default_action             = "Deny" # 기본적으로 외부 인터넷 접속 모두 차단
    virtual_network_subnet_ids = [azurerm_subnet.consumer_subnet.id] # 오직 컨슈머 서브넷만 허용
    ip_rules                   = ["218.39.98.40"] # 사용자 공인 IP (Data Lake 업그레이드 후 요구)
  }

  tags = {
    environment = "dev"
    purpose     = "raw-data-lake"
  }
}

# 데이터를 담을 Data Lake Gen2 전용 파일 시스템(컨테이너) 생성
resource "azurerm_storage_data_lake_gen2_filesystem" "raw_filesystem" {
  name                  = "raw-topic-container"
  storage_account_id    = azurerm_storage_account.raw_storage.id
 
  # 권한이 먼저 부여된 후에 컨테이너를 만들도록 순서 강제
  depends_on = [
    azurerm_role_assignment.storage_data_contributor
  ]
}

# 현재 실행 중인 내 계정 정보 가져오기
data "azurerm_client_config" "current" {}

# 내 계정에 '저장소 Blob 데이터 기여가' 권한 자동 부여
resource "azurerm_role_assignment" "storage_data_contributor" {
  scope                = azurerm_storage_account.raw_storage.id # 본인의 스토리지 리소스 이름으로 수정
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}