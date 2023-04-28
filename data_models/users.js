module.exports = (sequelize, type) => {
  return sequelize.define('users', {
    uuid: {
      type: type.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: type.UUIDV4
    },
    email: {
      type: type.STRING,
      unique: true,
      allowNull: false
    },
    password: {
      type: type.STRING,
      allowNull: false
    },
    isVerified: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isAdmin: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    confirmation: {
      type: type.STRING(32),
      allowNull: true
    },
    Name: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    Surname: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    City: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    StreetACP: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    PostCode: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    Telephone: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    Company: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    Dic: {
      type: type.STRING(20),
      allowNull: false,
      defaultValue: ''
    },
    Ico: {
      type: type.STRING,
      allowNull: false,
      defaultValue: ''
    },
    Level: {
      type: type.INTEGER(5),
      allowNull: false,
      defaultValue: 2
    },
    StepProfileFinished: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    RegComplete: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    RegEmail: {
      type: type.STRING,
      allowNull: false
    },
    SmartRegComplete: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    SmartStamp: {
      type: type.INTEGER(11),
      allowNull: false
    },
    CreditCounts: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 15000
    },
    CreditVariant: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 15000
    },
    InvoicePeriod: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'month'
    },
    NextPayDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    NextPayDate_ts: {
      type: type.INTEGER(11),
      allowNull: false
    },
    PaymentVersion: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'Trial'
    },
    Price: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    RegisterDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    Trial: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    StepHelpFinished: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    heurekaAPIkey: {
      type: type.STRING(32),
      allowNull: true,
      defaultValue: ''
    },
    StepHeurekaFinished: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    StepZboziFinished: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    StepTeamFinished: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    a_box: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'none'
    },
    a_cha: {
      type: type.STRING,
      allowNull: false,
      defaultValue: 'none'
    },
    deadtimeExpiration: {
      type: type.INTEGER(11),
      allowNull: false
    },
    flags: {
      type: type.INTEGER
    },
    cas: {
      type: type.BIGINT.UNSIGNED
    },
    expiry: {
      type: type.INTEGER
    },
    groupId: {
      type: type.INTEGER(11),
      allowNull: true
    },
    CreditNextPayDate: {
      type: type.DATEONLY,
      allowNull: false
    },
    CreditNextPayDate_ts: {
      type: type.INTEGER(11),
      allowNull: false
    },
    confirmExpiry: {
        type: type.INTEGER(11),
        allowNull: true
    },
    topVariablesAllowed: {
        type: type.BOOLEAN,
        allowNull: true,
    },
    abTestingAllowed: {
        type: type.BOOLEAN,
        allowNull: true,
    },
    apiKey: {
        type: type.STRING(32),
        allowNull: true,
    },
    note: {
        type: type.STRING(255),
        allowNull: true
    },
    internalNote: {
        type: type.STRING(2048),
        allowNull: true
    }
  }, {
    indexes: [
      {
        unique: false,
        name: 'expiration',
        fields: ['deadtimeExpiration']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
