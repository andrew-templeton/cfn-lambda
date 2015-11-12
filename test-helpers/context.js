
module.exports = {
  done: function() {
    this.callback && this.callback();
  },
  // Sample value
  invokedFunctionArn: 'arn:aws:lambda:fake-region-1:012345678910' +
  	':function:CfnLambdaResource-TestFunction'
};

