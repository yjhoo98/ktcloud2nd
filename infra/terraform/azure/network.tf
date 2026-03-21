# VNet 생성
resource "azurerm_virtual_network" "vnet" {
  name                = "palja-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

# Kafka Broker Subnet 생성
resource "azurerm_subnet" "broker_subnet" {
  name                 = "broker-subnet"
  address_prefixes     = ["10.0.1.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
}

# Kafka Consumer Subnet 생성
resource "azurerm_subnet" "consumer_subnet" {
	name                 = "consumer-subnet"
  address_prefixes     = ["10.0.2.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
}

# DB Subnet 생성
resource "azurerm_subnet" "db_subnet" {
	name                 = "db-subnet"
  address_prefixes     = ["10.0.3.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
}

# Broker NSG 생성
resource "azurerm_network_security_group" "broker_nsg" {
  name                = "broker-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-kafka-brokers"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    destination_port_ranges    = ["9094", "9095", "9096"]
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-ssh"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*" # 임시 개방
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# Consumer NSG 생성
resource "azurerm_network_security_group" "consumer_nsg" {
  name                = "consumer-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "10.0.1.0/24"
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

	# Kafka Connect API용
  security_rule {
    name                       = "allow-kafka-connect-api"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*" 
    destination_port_range     = "8083"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# DB NSG 생성
resource "azurerm_network_security_group" "db_nsg" {
  name                = "db-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-db"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "10.0.2.0/24"
    destination_port_range     = "5432"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# NSG 연결
resource "azurerm_subnet_network_security_group_association" "broker_assoc" {
  subnet_id                 = azurerm_subnet.broker_subnet.id
  network_security_group_id = azurerm_network_security_group.broker_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "consumer_assoc" {
  subnet_id                 = azurerm_subnet.consumer_subnet.id
  network_security_group_id = azurerm_network_security_group.consumer_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "db_assoc" {
  subnet_id                 = azurerm_subnet.db_subnet.id
  network_security_group_id = azurerm_network_security_group.db_nsg.id
}