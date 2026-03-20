data "terraform_remote_state" "network" {
  backend = "local"

  config = {
    path = var.network_state_path
  }
}
