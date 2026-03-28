variable "region" {
  description = "Azure region"
  type        = string
  default     = "Korea Central"
}

variable "vm_size" {
  description = "VM Size"
  type        = string
  
  # 2 Cores / 8GB Memory
  # 테스트: Standard_B2ms (Cost-efficient)
  # 데모: Standard_D2s_v3 (Better Kafka performance)
  default     = "Standard_B2ms"
}

variable "vm_image" {
  description = "VM Image"
  type        = map(string)
  default = {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}

# Github Secrets를 통해 배포될 때 주입
variable "public_key" {
  description = "Public Key"
  type        = string
}

variable "admin_name" {
  description = "관리자 계정명"
  type        = string
  default     = "palja"
}

variable "onprem_ip" {
  description = "온프레미스(차량 시뮬레이터) 공인 IP"
  type        = string
}