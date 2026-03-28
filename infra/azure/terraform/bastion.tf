# Bastion Public IP 생성
resource "azurerm_public_ip" "bastion_public_ip" {
  name                = "bastion-public-ip"
  location            = var.region
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1"]
}

# Bastion NIC 생성
resource "azurerm_network_interface" "bastion_nic" {
  name                = "bastion-nic"
  location            = var.region
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "external"
    subnet_id                     = azurerm_subnet.bastion_subnet.id 
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.bastion_public_ip.id
  }
}

# Bastion VM 인스턴스 생성
resource "azurerm_linux_virtual_machine" "bastion_vm" {
  name                = "bastion-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.region
  size                = "Standard_B1s" # 1 Cores / 1GB Memory
  zone                = "1"
  admin_username      = var.admin_name

  network_interface_ids = [
    azurerm_network_interface.bastion_nic.id
  ]

  admin_ssh_key {
    username   = var.admin_name
    public_key = var.public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS" # 제일 저렴한 HDD/SSD
  }

  source_image_reference {
    publisher = var.vm_image.publisher
    offer     = var.vm_image.offer
    sku       = var.vm_image.sku
    version   = var.vm_image.version
  }
}