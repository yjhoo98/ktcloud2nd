variable "aws_region" {
  description = "AWS region for compute resources."
  type        = string
  default     = "ap-northeast-2"
}

variable "network_state_bucket" {
  description = "S3 bucket that stores the network terraform state file."
  type        = string
  default     = "8team-terraform-tfstate"
}

variable "network_state_key" {
  description = "S3 object key for the network terraform state file."
  type        = string
  default     = "network/terraform.tfstate"
}

variable "network_state_region" {
  description = "AWS region of the S3 bucket that stores the network terraform state file."
  type        = string
  default     = "ap-northeast-2"
}

variable "network_state_access_key" {
  description = "Access key used to read the network terraform state from the tfstate S3 account."
  type        = string
  sensitive   = true
}

variable "network_state_secret_key" {
  description = "Secret key used to read the network terraform state from the tfstate S3 account."
  type        = string
  sensitive   = true
}

variable "data_state_path" {
  description = "Local path to the data terraform state file."
  type        = string
  default     = "../data/terraform.tfstate"
}

variable "cluster_name" {
  description = "K3s cluster name used by Cluster Autoscaler."
  type        = string
  default     = "8team-cluster"
}

variable "k3s_shared_token" {
  description = "Shared token used by K3s servers and agents."
  type        = string
  sensitive   = true
}

variable "master_a_private_ip" {
  description = "Static private IP for the primary K3s server in subnet A."
  type        = string
}

variable "master_c_private_ip" {
  description = "Static private IP for the secondary K3s server in subnet C."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used for naming all AWS resources in this module."
  type        = string
  default     = "ktcloud2nd-dev"
}

variable "ami_id" {
  description = "AMI ID for K3s nodes (Ubuntu 22.04 ap-northeast-2)."
  type        = string
  default     = "ami-084a56dceed3eb9bb"
}

variable "instance_type" {
  description = "EC2 instance type for K3s master and worker nodes."
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "EC2 key pair name for SSH access to K3s nodes."
  type        = string
  default     = "infra"
}
