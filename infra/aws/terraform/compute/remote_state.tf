data "terraform_remote_state" "network" {
  backend = "local"

  config = {
    path = var.network_state_path
  }
}

data "terraform_remote_state" "data" {
  backend = "local"

  config = {
    path = var.data_state_path
  }
}
