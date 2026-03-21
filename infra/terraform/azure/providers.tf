provider "azurerm" {
  features {}
}

# Resource Group 생성
resource "azurerm_resource_group" "rg" {
  name     = "palja-rg"
  location = var.region
}