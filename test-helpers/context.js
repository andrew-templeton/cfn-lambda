
module.exports = {
  done: function() {
    this.callback && this.callback();
  }
};

