variable "region" {
  description = "Azure region"
  type        = string
  default     = "Korea Central"
}

variable "vm_size" {
  description = "VM Size"
  type        = string
  default     = "Standard_B2s"
}

variable "vm_image" {
  description = "VM Image"
  type        = map(string)
  default = {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
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

# Github Secrets를 통해 배포될 때 주입
variable "db_password" {
  description = "PostgreSQL DB 관리자 비밀번호"
  type        = string
  sensitive   = true
}